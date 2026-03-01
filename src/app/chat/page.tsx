'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { MessageSquare, Send } from 'lucide-react';
import Sidebar from '@/components/Sidebar/Sidebar';
import { ROLE_LABELS } from '@/lib/types';
import type { Role } from '@/lib/types';
import './chat.css';

interface ChatUser {
    id: string;
    name: string;
    avatar: string | null;
    role?: string;
}

interface Conversation {
    partner: ChatUser;
    lastMessage: { content: string | null; createdAt: string } | null;
    unreadCount: number;
}

interface Message {
    id: string;
    content: string | null;
    senderId: string;
    sender: ChatUser;
    createdAt: string;
}

export default function ChatPage() {
    const { data: session, status: authStatus } = useSession();
    const router = useRouter();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activePartner, setActivePartner] = useState<ChatUser | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [allUsers, setAllUsers] = useState<ChatUser[]>([]);
    const [showNewChat, setShowNewChat] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const pollRef = useRef<NodeJS.Timeout>(undefined);
    const userId = (session?.user as any)?.id;

    useEffect(() => {
        if (authStatus === 'unauthenticated') router.push('/login');
    }, [authStatus, router]);

    // Fetch conversations
    const fetchConversations = useCallback(async () => {
        const res = await fetch('/api/chat');
        if (res.ok) setConversations(await res.json());
    }, []);

    useEffect(() => { fetchConversations(); }, [fetchConversations]);

    // Fetch all users for new chat
    useEffect(() => {
        fetch('/api/users')
            .then(r => r.ok ? r.json() : [])
            .then(setAllUsers)
            .catch(() => { });
    }, []);

    // Load messages when partner selected
    const loadMessages = useCallback(async (partnerId: string) => {
        const res = await fetch(`/api/chat?partnerId=${partnerId}`);
        if (res.ok) {
            setMessages(await res.json());
            setTimeout(() => scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight), 50);
        }
    }, []);

    useEffect(() => {
        if (!activePartner) return;
        loadMessages(activePartner.id);

        // Poll for new messages every 3s
        pollRef.current = setInterval(() => loadMessages(activePartner.id), 3000);
        return () => clearInterval(pollRef.current);
    }, [activePartner, loadMessages]);

    const handleSend = async () => {
        if (!input.trim() || !activePartner) return;
        const content = input.trim();
        setInput('');

        // Optimistic add
        const tempMsg: Message = {
            id: `temp-${Date.now()}`,
            content,
            senderId: userId,
            sender: { id: userId, name: (session?.user as any)?.name || '', avatar: null },
            createdAt: new Date().toISOString(),
        };
        setMessages(prev => [...prev, tempMsg]);
        setTimeout(() => scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight), 50);

        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ receiverId: activePartner.id, content }),
        });

        if (res.ok) {
            const real = await res.json();
            setMessages(prev => prev.map(m => m.id === tempMsg.id ? real : m));
            fetchConversations();
        }
    };

    const selectPartner = (partner: ChatUser) => {
        setActivePartner(partner);
        setShowNewChat(false);
    };

    const startNewChat = (uid: string) => {
        const user = allUsers.find(u => u.id === uid);
        if (user) selectPartner(user);
    };

    const formatTime = (d: string) => {
        const date = new Date(d);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        if (diff < 86400000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    };

    if (authStatus === 'loading') {
        return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-secondary)' }}>Loading...</div>;
    }

    if (!session) return null;

    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            <Sidebar />
            <div style={{ flex: 1, marginLeft: 'var(--sidebar-width)' }}>
                <div className="chat-layout">
                    {/* Contact sidebar */}
                    <div className="chat-contacts">
                        <div className="chat-contacts-header">
                            <div className="chat-contacts-title">
                                <MessageSquare size={18} /> Chat
                            </div>
                            <button className="chat-new-btn" onClick={() => setShowNewChat(!showNewChat)}>
                                + New
                            </button>
                        </div>

                        {showNewChat && (
                            <div className="chat-user-picker">
                                <select onChange={e => { if (e.target.value) startNewChat(e.target.value); }} defaultValue="" style={{ width: '100%', padding: '8px', marginBottom: '16px', borderRadius: '4px', border: '1px solid var(--divider)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
                                    <option value="" disabled>Select a user to chat...</option>
                                    {allUsers?.filter(u => u.id !== userId)?.map(u => (
                                        <option key={u.id} value={u.id}>{u.name} ({ROLE_LABELS[u.role as Role] || u.role})</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="chat-contact-list">
                            {conversations.map(conv => (
                                <div
                                    key={conv.partner.id}
                                    className={`chat-contact-item ${activePartner?.id === conv.partner.id ? 'active' : ''}`}
                                    onClick={() => selectPartner(conv.partner)}
                                >
                                    <div className="chat-contact-avatar">
                                        {conv.partner.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="chat-contact-info">
                                        <div className="chat-contact-name">{conv.partner.name}</div>
                                        <div className="chat-contact-preview">
                                            {conv.lastMessage?.content || 'No messages'}
                                        </div>
                                    </div>
                                    <div className="chat-contact-meta">
                                        {conv.lastMessage && (
                                            <span className="chat-contact-time">{formatTime(conv.lastMessage.createdAt)}</span>
                                        )}
                                        {conv.unreadCount > 0 && (
                                            <span className="chat-unread-badge">{conv.unreadCount}</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Message area */}
                    {activePartner ? (
                        <div className="chat-messages-area">
                            <div className="chat-messages-header">
                                <div className="chat-contact-avatar" style={{ width: 32, height: 32, fontSize: 13 }}>
                                    {activePartner.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div className="chat-messages-name">{activePartner.name}</div>
                                    {activePartner.role && (
                                        <div className="chat-messages-role">{ROLE_LABELS[activePartner.role as Role] || activePartner.role}</div>
                                    )}
                                </div>
                            </div>

                            <div className="chat-messages-scroll" ref={scrollRef}>
                                {messages.map(msg => (
                                    <div key={msg.id} className={`chat-message ${msg.senderId === userId ? 'sent' : 'received'}`}>
                                        <div>
                                            <div className="chat-message-bubble">{msg.content}</div>
                                            <div className="chat-message-time">{formatTime(msg.createdAt)}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="chat-input-area">
                                <input
                                    className="chat-input"
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                                    placeholder="Type a message..."
                                />
                                <button className="chat-send-btn" onClick={handleSend} disabled={!input.trim()}>
                                    <Send size={16} />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="chat-empty">
                            <div style={{ textAlign: 'center' }}>
                                <MessageSquare size={48} style={{ marginBottom: 12, opacity: 0.3 }} />
                                <div>Select a conversation or start a new chat</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
