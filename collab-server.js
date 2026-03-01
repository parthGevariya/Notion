// Standalone Socket.io server for Y.js real-time collaboration
// Run: node collab-server.js
require('dotenv').config();
const { Server: SocketServer } = require('socket.io');
const Y = require('yjs');
const http = require('http');
const { encodeStateAsUpdate, applyUpdate } = Y;

const PORT = 3001;
const server = http.createServer();
const io = new SocketServer(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
});

// Store Y.js documents in memory (per page)
const docs = new Map();

// Block-level locks: Map<docName, Map<blockId, { userId, userName, expires: timestamp }>>
const blockLocks = new Map();

const BLOCK_LOCK_TIMEOUT_MS = 30 * 1000; // 30 seconds auto-expiry

function getOrCreateDoc(docName) {
    if (!docs.has(docName)) {
        const doc = new Y.Doc();
        docs.set(docName, { doc, clients: new Map() });
    }
    return docs.get(docName);
}

/** Get or create the lock map for a document */
function getDocLocks(docName) {
    if (!blockLocks.has(docName)) blockLocks.set(docName, new Map());
    return blockLocks.get(docName);
}

/** Broadcast current lock state to everyone in the doc room */
function broadcastLocks(docName) {
    const locks = getDocLocks(docName);
    const now = Date.now();
    const activeLocks = {};
    for (const [blockId, info] of locks.entries()) {
        if (info.expires > now) activeLocks[blockId] = { userId: info.userId, userName: info.userName };
        else locks.delete(blockId); // clean expired locks on read
    }
    io.to(docName).emit('block-locks-update', activeLocks);
}

io.on('connection', (socket) => {
    let currentDocName = null;
    let currentUserId = null;
    let currentUserName = null;

    socket.on('join-doc', ({ docName, userName, userColor, userId }) => {
        currentDocName = docName;
        currentUserId = userId || socket.id;
        currentUserName = userName;
        const entry = getOrCreateDoc(docName);
        entry.clients.set(socket.id, { userName, userColor, userId: currentUserId });

        socket.join(docName);

        // Send current document state
        const state = encodeStateAsUpdate(entry.doc);
        socket.emit('doc-state', { state: Buffer.from(state).toString('base64') });

        // Send current lock state to the joining user
        broadcastLocks(docName);

        // Broadcast updated user list
        broadcastUsers(docName, entry);

        console.log(`[Collab] ${userName} joined "${docName}" (${entry.clients.size} users)`);
    });

    socket.on('doc-update', ({ update }) => {
        if (!currentDocName) return;
        const entry = docs.get(currentDocName);
        if (!entry) return;
        const decoded = Buffer.from(update, 'base64');
        applyUpdate(entry.doc, new Uint8Array(decoded));
        socket.to(currentDocName).emit('doc-update', { update });
    });

    socket.on('cursor-update', (data) => {
        if (!currentDocName) return;
        socket.to(currentDocName).emit('cursor-update', { clientId: socket.id, ...data });
    });

    // ── Block locking (soft lock for Script page) ──────────────────────────
    // Client emits this when user starts editing a specific script block
    socket.on('block-lock', ({ blockId }) => {
        if (!currentDocName || !blockId) return;
        const locks = getDocLocks(currentDocName);

        // Check if another user already holds a non-expired lock on this block
        const existing = locks.get(blockId);
        if (existing && existing.expires > Date.now() && existing.userId !== currentUserId) {
            // Reject — tell the requester who has the lock
            socket.emit('block-lock-rejected', { blockId, lockedBy: existing.userName });
            return;
        }

        // Grant lock — set/refresh with 30s expiry
        locks.set(blockId, {
            userId: currentUserId,
            userName: currentUserName,
            socketId: socket.id,
            expires: Date.now() + BLOCK_LOCK_TIMEOUT_MS,
        });

        broadcastLocks(currentDocName);
        console.log(`[Collab] Block "${blockId}" locked by ${currentUserName} in "${currentDocName}"`);
    });

    // Client emits this when user stops editing a script block (blur / navigate away)
    socket.on('block-unlock', ({ blockId }) => {
        if (!currentDocName || !blockId) return;
        const locks = getDocLocks(currentDocName);
        const existing = locks.get(blockId);
        // Only the lock owner can release it
        if (existing?.userId === currentUserId) {
            locks.delete(blockId);
            broadcastLocks(currentDocName);
            console.log(`[Collab] Block "${blockId}" unlocked by ${currentUserName}`);
        }
    });
    // ── End block locking ───────────────────────────────────────────────────

    // ── Global App & Chat Rooms ──────────────────────────────────────────────
    socket.on('join-app', ({ userId }) => {
        if (!userId) return;
        currentUserId = userId; // Store for this socket
        socket.join(`user_${userId}`);
        socket.join('group_chat');
        console.log(`[App] User ${userId} joined global chat rooms.`);
    });

    socket.on('send-group-message', (message) => {
        socket.to('group_chat').emit('new-group-message', message);
    });

    socket.on('send-dm', ({ receiverId, message }) => {
        if (!receiverId) return;
        socket.to(`user_${receiverId}`).emit('new-dm', message);
        // We do not emit back to the sender; the sender UI handles it optimistically
    });

    socket.on('send-notification', ({ receiverId, notification }) => {
        if (!receiverId) return;
        socket.to(`user_${receiverId}`).emit('new-notification', notification);
    });

    socket.on('typing-start', ({ isGroup, receiverId, userName }) => {
        if (isGroup) {
            socket.to('group_chat').emit('typing-update', { isGroup: true, userName, isTyping: true });
        } else if (receiverId) {
            socket.to(`user_${receiverId}`).emit('typing-update', { isGroup: false, userName, senderId: currentUserId, isTyping: true });
        }
    });

    socket.on('typing-stop', ({ isGroup, receiverId, userName }) => {
        if (isGroup) {
            socket.to('group_chat').emit('typing-update', { isGroup: true, userName, isTyping: false });
        } else if (receiverId) {
            socket.to(`user_${receiverId}`).emit('typing-update', { isGroup: false, userName, senderId: currentUserId, isTyping: false });
        }
    });
    // ── End Global App & Chat Rooms ──────────────────────────────────────────

    socket.on('disconnect', () => {
        if (currentDocName) {
            const entry = docs.get(currentDocName);
            if (entry) {
                const user = entry.clients.get(socket.id);
                entry.clients.delete(socket.id);
                broadcastUsers(currentDocName, entry);

                // Release all locks held by this socket
                const locks = getDocLocks(currentDocName);
                for (const [blockId, info] of locks.entries()) {
                    if (info.socketId === socket.id) {
                        locks.delete(blockId);
                    }
                }
                broadcastLocks(currentDocName);

                if (user) console.log(`[Collab] ${user.userName} left "${currentDocName}" (${entry.clients.size} users)`);

                // Clean up empty docs after 60s
                if (entry.clients.size === 0) {
                    setTimeout(() => {
                        const e = docs.get(currentDocName);
                        if (e && e.clients.size === 0) {
                            docs.delete(currentDocName);
                            blockLocks.delete(currentDocName);
                            console.log(`[Collab] Doc cleaned: "${currentDocName}"`);
                        }
                    }, 60000);
                }
            }
        }
    });
});

function broadcastUsers(docName, entry) {
    const users = Array.from(entry.clients.values());
    io.to(docName).emit('users-update', { users, count: users.length });
}

// ── Task Deadline Cron (Every 5 mins) ───────────────
setInterval(async () => {
    try {
        const URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';
        const res = await fetch(`${URL}/api/cron/deadlines`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (res.ok) {
            const notifications = await res.json();
            for (const item of notifications) {
                // Return payload from the API shape { userId, payload: NotificationData }
                io.to(`user_${item.userId}`).emit('new-notification', item.payload);
                console.log(`[Cron] Sent deadline notification to user ${item.userId}`);
            }
        }
    } catch (err) {
        console.error('[Cron] Error running deadline check via API:', err.message);
    }
}, 5 * 60 * 1000); // 5 minutes

server.listen(PORT, () => {
    console.log(`\n  🔄 Collab server running on http://localhost:${PORT}\n`);
});

// ── HTTP REST endpoint for Next.js API to push notifications ─────────────────
// Called by /api/reminders POST after creating a task
server.on('request', (req, res) => {
    // Allow CORS for local Next.js
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method === 'POST' && req.url === '/push-notification') {
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
            try {
                const { userId, notification } = JSON.parse(body);
                if (!userId || !notification) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'userId and notification required' }));
                    return;
                }
                io.to(`user_${userId}`).emit('new-notification', notification);
                console.log(`[Push] Notification sent to user_${userId}:`, notification.title);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
        return;
    }

    if (req.method === 'POST' && req.url === '/push-task-assigned') {
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
            try {
                const { userId, task } = JSON.parse(body);
                if (!userId || !task) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'userId and task required' }));
                    return;
                }
                io.to(`user_${userId}`).emit('task-assigned', task);
                console.log(`[Push] Task assigned event to user_${userId}`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
        return;
    }

    // Default 404
    res.writeHead(404);
    res.end();
});
