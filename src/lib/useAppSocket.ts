'use client';

/**
 * useAppSocket — singleton Socket.IO hook for the entire app.
 *
 * Manages one shared connection per browser tab to the collab server
 * (port 3001). Automatically joins the `app_global` room so any component
 * can receive live app-wide events (page-created, reminder-created, etc.).
 *
 * Usage:
 *   const socket = useAppSocket();
 *   useEffect(() => {
 *     if (!socket) return;
 *     socket.on('page-created', handler);
 *     return () => { socket.off('page-created', handler); };
 *   }, [socket]);
 */
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { io, Socket } from 'socket.io-client';

let sharedSocket: Socket | null = null;

const COLLAB_URL =
    process.env.NEXT_PUBLIC_COLLAB_SERVER_URL || 'http://localhost:3001';

export function useAppSocket(): Socket | null {
    const { data: session } = useSession();
    const userId = (session?.user as { id?: string })?.id;

    const [socket, setSocket] = useState<Socket | null>(null);

    useEffect(() => {
        if (!userId) return;

        // Reuse existing connection if already established
        if (!sharedSocket || !sharedSocket.connected) {
            sharedSocket = io(COLLAB_URL, {
                transports: ['websocket', 'polling'],
                reconnectionAttempts: Infinity,
                reconnectionDelay: 2000,
            });
        }

        const s = sharedSocket;

        const onConnect = () => {
            s.emit('join-app', { userId });
        };

        // If already connected, join immediately
        if (s.connected) {
            s.emit('join-app', { userId });
        }

        s.on('connect', onConnect);

        setSocket(s);

        return () => {
            s.off('connect', onConnect);
            // Do NOT disconnect — socket is shared across components
        };
    }, [userId]);

    return socket;
}
