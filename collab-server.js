// Standalone Socket.io server for Y.js real-time collaboration
// Run: node collab-server.js
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

function getOrCreateDoc(docName) {
    if (!docs.has(docName)) {
        const doc = new Y.Doc();
        docs.set(docName, { doc, clients: new Map() });
    }
    return docs.get(docName);
}

io.on('connection', (socket) => {
    let currentDocName = null;

    socket.on('join-doc', ({ docName, userName, userColor }) => {
        currentDocName = docName;
        const entry = getOrCreateDoc(docName);
        entry.clients.set(socket.id, { userName, userColor });

        socket.join(docName);

        // Send current document state
        const state = encodeStateAsUpdate(entry.doc);
        socket.emit('doc-state', { state: Buffer.from(state).toString('base64') });

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

    socket.on('disconnect', () => {
        if (currentDocName) {
            const entry = docs.get(currentDocName);
            if (entry) {
                const user = entry.clients.get(socket.id);
                entry.clients.delete(socket.id);
                broadcastUsers(currentDocName, entry);

                if (user) console.log(`[Collab] ${user.userName} left "${currentDocName}" (${entry.clients.size} users)`);

                // Clean up empty docs after 60s
                if (entry.clients.size === 0) {
                    setTimeout(() => {
                        const e = docs.get(currentDocName);
                        if (e && e.clients.size === 0) {
                            docs.delete(currentDocName);
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

server.listen(PORT, () => {
    console.log(`\n  🔄 Collab server running on http://localhost:${PORT}\n`);
});
