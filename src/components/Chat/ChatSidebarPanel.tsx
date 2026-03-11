'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { MessageSquare, X, ArrowLeft, Plus } from 'lucide-react';
import { useAppSocket } from '@/components/Collab/GlobalSocketProvider';
import GroupChatPanel from './GroupChatPanel';
import DMPanel from './DMPanel';
import styles from './ChatSidebarPanel.module.css';

export default function ChatSidebarPanel() {
    const { data: session, status } = useSession();
    const { socket } = useAppSocket();
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'users' | 'group'>('users');
    const [selectedUser, setSelectedUser] = useState<any | null>(null);
    const [users, setUsers] = useState<any[]>([]);
    const [conversations, setConversations] = useState<any[]>([]);
    const [showNewChat, setShowNewChat] = useState(false);

    // ── Unread tracking ──
    const [unreadDMs, setUnreadDMs] = useState(0);
    const [unreadGroupMentions, setUnreadGroupMentions] = useState(false);
    const [hasMentionBadge, setHasMentionBadge] = useState(false);

    // Use refs to track current open state for the event listeners
    const stateRef = useRef({ isOpen, activeTab, selectedUserId: selectedUser?.id });
    useEffect(() => {
        stateRef.current = { isOpen, activeTab, selectedUserId: selectedUser?.id };
    }, [isOpen, activeTab, selectedUser]);

    const userId = (session?.user as any)?.id;

    // Fetch users for DM list
    useEffect(() => {
        if (status !== 'authenticated') return;
        fetch('/api/users')
            .then(r => r.ok ? r.json() : [])
            .then(data => setUsers(data.filter((u: any) => u.id !== userId)))
            .catch(console.error);
            
        fetch('/api/chat')
            .then(r => r.ok ? r.json() : [])
            .then(setConversations)
            .catch(console.error);
    }, [status, userId]);

    // ── Centralized Event Handlers ──
    useEffect(() => {
        const handleDMNotif = (e: Event) => {
            const msg = (e as CustomEvent).detail;
            const { isOpen, activeTab, selectedUserId } = stateRef.current;
            // Only count if panel is closed or on group tab or viewing different user
            if (!isOpen || activeTab !== 'users' || selectedUserId !== msg?.senderId) {
                setUnreadDMs(prev => prev + 1);
            }
        };

        const handleAppNotif = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail?.type === 'mention') {
                const { isOpen, activeTab } = stateRef.current;
                if (!isOpen || activeTab !== 'group') {
                    setUnreadGroupMentions(true);
                    setHasMentionBadge(true);
                }
            }
        };

        const handleOpenDM = (e: Event) => {
            const { name } = (e as CustomEvent).detail;
            const user = users.find((u: any) => u.name === name);
            if (user) {
                setSelectedUser(user);
                setActiveTab('users');
                setIsOpen(true);
            }
        };

        window.addEventListener('new-dm-notification', handleDMNotif);
        window.addEventListener('new-app-notification', handleAppNotif);
        window.addEventListener('open-dm-for-user', handleOpenDM);

        return () => {
            window.removeEventListener('new-dm-notification', handleDMNotif);
            window.removeEventListener('new-app-notification', handleAppNotif);
            window.removeEventListener('open-dm-for-user', handleOpenDM);
        };
    }, [users]); // Stable listeners

    // Reset unread DMs when opening DM tab
    useEffect(() => {
        if (isOpen && activeTab === 'users' && !selectedUser) {
            setUnreadDMs(0);
        }
    }, [isOpen, activeTab, selectedUser]);

    // Reset group mention badge when viewing group tab
    useEffect(() => {
        if (isOpen && activeTab === 'group') {
            setUnreadGroupMentions(false);
            setHasMentionBadge(false);
        }
    }, [isOpen, activeTab]);

    // ── Dispatch badge state for sidebar to pick up ──
    const dispatchBadges = () => {
        const hasBadge = unreadDMs > 0 || hasMentionBadge;
        window.dispatchEvent(new CustomEvent('chat-badge-update', {
            detail: { hasBadge, hasMention: hasMentionBadge, unreadDMs }
        }));
    };

    useEffect(() => {
        dispatchBadges();
        // Sync every 2 seconds in case Sidebar remounted
        const interval = setInterval(dispatchBadges, 2000);
        return () => clearInterval(interval);
    }, [unreadDMs, hasMentionBadge]);

    if (status !== 'authenticated') return null;

    const handleSelectUser = (u: any) => {
        setSelectedUser(u);
    };

    const handleBack = () => setSelectedUser(null);

    return (
        <>
            {/* Floating Bubble Button */}
            {!isOpen && (
                <button className={styles.floatingBtn} onClick={() => setIsOpen(true)}>
                    <MessageSquare size={24} />
                    {hasMentionBadge ? (
                        <span className={styles.mentionBadge}>@</span>
                    ) : unreadDMs > 0 ? (
                        <span className={styles.badge}>{unreadDMs}</span>
                    ) : null}
                </button>
            )}

            {isOpen && <div className={styles.overlay} onClick={() => setIsOpen(false)} />}

            {/* Slide-in Panel */}
            <div className={`${styles.panel} ${isOpen ? styles.open : ''}`}>
                <div className={styles.header}>
                    <div className={styles.title} style={{ width: '100%', justifyContent: 'space-between' }}>
                        {selectedUser ? (
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <button className={styles.backBtn} onClick={handleBack}>
                                    <ArrowLeft size={18} />
                                </button>
                                {selectedUser.name}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <MessageSquare size={18} />
                                    Team Chat
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    {activeTab === 'users' && !showNewChat && (
                                        <button 
                                            className={styles.closeBtn} 
                                            title="New Chat"
                                            onClick={() => setShowNewChat(true)}
                                            style={{ marginRight: '4px' }}
                                        >
                                            <Plus size={18} />
                                        </button>
                                    )}
                                    <button className={styles.closeBtn} onClick={() => setIsOpen(false)}>
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {!selectedUser ? (
                    <div className={styles.content}>
                        <div className={styles.tabBar}>
                            <button
                                className={`${styles.tab} ${activeTab === 'users' ? styles.active : ''}`}
                                onClick={() => setActiveTab('users')}
                            >
                                Direct Messages
                                {unreadDMs > 0 && <span className={styles.tabBadge}>{unreadDMs}</span>}
                            </button>
                            <button
                                className={`${styles.tab} ${activeTab === 'group' ? styles.active : ''}`}
                                onClick={() => setActiveTab('group')}
                            >
                                Group Channel
                                {unreadGroupMentions && <span className={styles.tabMentionBadge}>@</span>}
                            </button>
                        </div>

                        {activeTab === 'users' && (
                            <div className={styles.chatList}>
                                {showNewChat && (
                                    <div style={{ padding: '16px', borderBottom: '1px solid var(--divider)' }}>
                                        <select 
                                            onChange={e => {
                                                const uid = e.target.value;
                                                const user = users.find(u => u.id === uid);
                                                if (user) {
                                                    handleSelectUser(user);
                                                    setShowNewChat(false);
                                                }
                                            }} 
                                            defaultValue="" 
                                            style={{ 
                                                width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--accent-blue)', 
                                                background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none'
                                            }}
                                        >
                                            <option value="" disabled>Select a user to chat...</option>
                                            {users.map(u => (
                                                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {conversations.length === 0 && !showNewChat ? (
                                    <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-tertiary)', fontSize: '13px' }}>
                                        No recent chats.<br/>Click "+ New Chat" to start one!
                                    </div>
                                ) : (
                                    conversations.map(conv => (
                                        <div key={conv.partner.id} className={styles.chatItem} onClick={() => handleSelectUser(conv.partner)}>
                                            <div className={styles.avatar}>
                                                {conv.partner.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className={styles.itemInfo}>
                                                <div className={styles.itemTitle}>{conv.partner.name}</div>
                                                <div className={styles.itemPreview} style={{ fontSize: '12px', color: conv.unreadCount > 0 ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: conv.unreadCount > 0 ? 600 : 400 }}>
                                                    {conv.lastMessage?.content || 'No messages'}
                                                </div>
                                            </div>
                                            {conv.unreadCount > 0 && (
                                                <div style={{ background: 'var(--accent-blue)', color: 'white', fontSize: '11px', fontWeight: 600, padding: '2px 6px', borderRadius: '10px', marginLeft: 'auto' }}>
                                                    {conv.unreadCount}
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {activeTab === 'group' && socket && (
                            <GroupChatPanel socket={socket} userId={userId} userName={session?.user?.name || ''} isActive={isOpen && activeTab === 'group' && !selectedUser} />
                        )}
                    </div>
                ) : (
                    <div className={styles.content}>
                        {socket && (
                            <DMPanel socket={socket} receiverId={selectedUser.id} userId={userId} userName={session?.user?.name || ''} isActive={isOpen && !!selectedUser} />
                        )}
                    </div>
                )}
            </div>
        </>
    );
}
