'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { MessageSquare, X, ArrowLeft } from 'lucide-react';
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
                    <div className={styles.title}>
                        {selectedUser ? (
                            <>
                                <button className={styles.backBtn} onClick={handleBack}>
                                    <ArrowLeft size={18} />
                                </button>
                                {selectedUser.name}
                            </>
                        ) : (
                            <>
                                <MessageSquare size={18} />
                                Team Chat
                            </>
                        )}
                    </div>
                    <button className={styles.closeBtn} onClick={() => setIsOpen(false)}>
                        <X size={20} />
                    </button>
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
                                {users.map(u => (
                                    <div key={u.id} className={styles.chatItem} onClick={() => handleSelectUser(u)}>
                                        <div className={styles.avatar}>
                                            {u.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className={styles.itemInfo}>
                                            <div className={styles.itemTitle}>{u.name}</div>
                                            <div className={styles.itemPreview}>{u.role}</div>
                                        </div>
                                    </div>
                                ))}
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
