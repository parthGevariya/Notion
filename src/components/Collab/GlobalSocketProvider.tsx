'use client';

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { io, Socket } from 'socket.io-client';

// ── AudioContext Sound Engine ────────────────────────────────────────────────
let sharedAudioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
    try {
        if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
            sharedAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (sharedAudioCtx.state === 'suspended') {
            sharedAudioCtx.resume();
        }
        return sharedAudioCtx;
    } catch {
        return null;
    }
}

function playTone(type: 'task' | 'mention' | 'chat' | 'deadline') {
    const ctx = getAudioCtx();
    if (!ctx) return;

    const schedule = (freq: number, startAt: number, duration: number, gain = 0.3) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        gainNode.gain.setValueAtTime(0, ctx.currentTime + startAt);
        gainNode.gain.linearRampToValueAtTime(gain, ctx.currentTime + startAt + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startAt + duration);
        osc.start(ctx.currentTime + startAt);
        osc.stop(ctx.currentTime + startAt + duration);
    };

    console.log('[Sound] Playing tone:', type);
    switch (type) {
        case 'task':
            schedule(440, 0, 0.15);
            schedule(660, 0.16, 0.2);
            break;
        case 'mention':
            schedule(880, 0, 0.12, 0.5);
            schedule(1100, 0.14, 0.2, 0.4);
            break;
        case 'chat':
            schedule(580, 0, 0.08, 0.25);
            schedule(720, 0.1, 0.1, 0.2);
            break;
        case 'deadline':
            schedule(330, 0, 0.12, 0.4);
            schedule(330, 0.18, 0.12, 0.4);
            schedule(330, 0.35, 0.2, 0.4);
            break;
    }
}

function getSoundType(t: string): 'task' | 'mention' | 'chat' | 'deadline' {
    if (t === 'mention') return 'mention';
    if (t === 'chat' || t === 'message') return 'chat';
    if (t === 'deadline') return 'deadline';
    return 'task';
}

// ── Context ──────────────────────────────────────────────────────────────────
type SocketContextType = { socket: Socket | null };
const SocketContext = createContext<SocketContextType>({ socket: null });

export function useAppSocket() {
    return useContext(SocketContext);
}

// ── Provider ─────────────────────────────────────────────────────────────────
export default function GlobalSocketProvider({ children }: { children: ReactNode }) {
    const { data: session, status } = useSession();
    const [socket, setSocket] = useState<Socket | null>(null);
    const socketRef = useRef<Socket | null>(null);
    const gestureUnlocked = useRef(false);

    // Extract stable userId
    const userId = (session?.user as { id?: string })?.id;

    // Gesture unlock for Audio
    useEffect(() => {
        const unlock = () => {
            if (gestureUnlocked.current) return;
            gestureUnlocked.current = true;
            getAudioCtx();
            console.log('[Sound] Audio system initialized via gesture');
        };
        document.addEventListener('mousedown', unlock);
        document.addEventListener('keydown', unlock);
        return () => {
            document.removeEventListener('mousedown', unlock);
            document.removeEventListener('keydown', unlock);
        };
    }, []);

    // Socket Connection
    useEffect(() => {
        if (status !== 'authenticated' || !userId) {
            if (socketRef.current) {
                console.log('[GlobalSocket] User unauthenticated/no-id, disconnecting');
                socketRef.current.disconnect();
                socketRef.current = null;
                setSocket(null);
            }
            return;
        }

        if (socketRef.current?.connected) return;

        const url = process.env.NEXT_PUBLIC_COLLAB_SERVER || 'http://localhost:3001';
        console.log('[GlobalSocket] 🛰️ Connecting to:', url, 'UID:', userId);

        const s = io(url, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            autoConnect: true,
        });

        // Room joining helper
        const joinRooms = () => {
            console.log('[GlobalSocket] 🏠 Joining rooms:', userId);
            s.emit('join-app', { userId });
        };

        s.on('connect', () => {
            console.log('[GlobalSocket] ✅ Connected ID:', s.id);
            joinRooms();
        });

        s.on('reconnect', () => {
            console.log('[GlobalSocket] 🔄 Reconnected.');
            joinRooms();
        });

        s.on('connect_error', (e) => console.error('[GlobalSocket] ❌ Error:', e.message));

        // Event Handlers
        s.on('new-notification', (notif: any) => {
            console.log('[GlobalSocket] 🔔 Notification:', notif.title);
            window.dispatchEvent(new CustomEvent('new-app-notification', { detail: notif }));
            playTone(getSoundType(notif.type));
        });

        s.on('new-dm', (msg: any) => {
            console.log('[GlobalSocket] 💬 DM from:', msg.senderId);
            window.dispatchEvent(new CustomEvent('new-dm-notification', { detail: msg }));
            playTone('chat');
        });

        s.on('new-group-message', (msg: any) => {
            console.log('[GlobalSocket] 👥 Group msg from:', msg.senderId);
            window.dispatchEvent(new CustomEvent('new-group-message', { detail: msg }));
            // Optional: play sublte sound if not in focus
        });

        s.on('task-assigned', (task: any) => {
            console.log('[GlobalSocket] 📋 Task assigned');
            window.dispatchEvent(new CustomEvent('new-app-notification', { detail: { ...task, title: 'New Task Assigned', type: 'task' } }));
            playTone('task');
        });

        s.on('deadline-alert', (data: any) => {
            console.log('[GlobalSocket] ⏰ Deadline!');
            window.dispatchEvent(new CustomEvent('new-app-notification', { detail: { ...data, type: 'deadline' } }));
            playTone('deadline');
        });

        socketRef.current = s;
        setSocket(s);

        return () => {
            console.log('[GlobalSocket] 🔌 Disconnecting component cleanup');
            s.disconnect();
            socketRef.current = null;
            setSocket(null);
        };
    }, [status, userId]);

    return (
        <SocketContext.Provider value={{ socket }}>
            {children}
        </SocketContext.Provider>
    );
}
