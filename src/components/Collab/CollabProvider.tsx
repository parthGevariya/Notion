'use client';

import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import * as Y from 'yjs';
import { useSession } from 'next-auth/react';

interface CollabUser {
    userName: string;
    userColor: string;
}

interface CollabContextValue {
    socket: Socket | null;
    ydoc: Y.Doc | null;
    isConnected: boolean;
    connectedUsers: CollabUser[];
}

const CollabContext = createContext<CollabContextValue>({
    socket: null,
    ydoc: null,
    isConnected: false,
    connectedUsers: [],
});

export function useCollab() {
    return useContext(CollabContext);
}

const RANDOM_COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
    '#BB8FCE', '#85C1E9', '#F0B27A', '#82E0AA',
];

function getRandomColor() {
    return RANDOM_COLORS[Math.floor(Math.random() * RANDOM_COLORS.length)];
}

export function CollabProvider({
    pageId,
    children,
}: {
    pageId: string;
    children: React.ReactNode;
}) {
    const { data: session } = useSession();
    const [socket, setSocket] = useState<Socket | null>(null);
    const [ydoc] = useState(() => new Y.Doc());
    const [isConnected, setIsConnected] = useState(false);
    const [connectedUsers, setConnectedUsers] = useState<CollabUser[]>([]);
    const colorRef = useRef(getRandomColor());

    useEffect(() => {
        if (!pageId || !session?.user) return;

        const sock = io('http://localhost:3001', {
            transports: ['websocket', 'polling'],
        });

        sock.on('connect', () => {
            setIsConnected(true);
            sock.emit('join-doc', {
                docName: `page-${pageId}`,
                userName: (session.user as any).name || 'Anonymous',
                userColor: colorRef.current,
            });
        });

        sock.on('doc-state', ({ state }: { state: string }) => {
            const decoded = Uint8Array.from(Buffer.from(state, 'base64'));
            Y.applyUpdate(ydoc, decoded);
        });

        sock.on('doc-update', ({ update }: { update: string }) => {
            const decoded = Uint8Array.from(Buffer.from(update, 'base64'));
            Y.applyUpdate(ydoc, decoded, 'remote');
        });

        sock.on('users-update', ({ users }: { users: CollabUser[] }) => {
            setConnectedUsers(users);
        });

        sock.on('disconnect', () => {
            setIsConnected(false);
        });

        const handleUpdate = (update: Uint8Array, origin: any) => {
            if (origin !== 'remote') {
                sock.emit('doc-update', {
                    update: Buffer.from(update).toString('base64'),
                });
            }
        };

        ydoc.on('update', handleUpdate);
        setSocket(sock);

        return () => {
            ydoc.off('update', handleUpdate);
            sock.disconnect();
            setSocket(null);
            setIsConnected(false);
            setConnectedUsers([]);
        };
    }, [pageId, session, ydoc]);

    return (
        <CollabContext.Provider value={{ socket, ydoc, isConnected, connectedUsers }}>
            {children}
        </CollabContext.Provider>
    );
}
