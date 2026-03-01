'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Bell, Check } from 'lucide-react';
import styles from './NotificationBell.module.css';
import { format } from 'date-fns';

export default function NotificationBell() {
    const { data: session } = useSession();
    const router = useRouter();
    const [notifications, setNotifications] = useState<any[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const unreadCount = notifications.filter(n => !n.isRead).length;

    useEffect(() => {
        if (!session?.user) return;

        fetch('/api/notifications')
            .then(r => r.ok ? r.json() : [])
            .then(setNotifications)
            .catch(console.error);

        const handleNewNotification = (e: any) => {
            const notif = e.detail;
            setNotifications(prev => [notif, ...prev]);
        };

        window.addEventListener('new-app-notification', handleNewNotification);
        return () => window.removeEventListener('new-app-notification', handleNewNotification);
    }, [session]);

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const markAllRead = async () => {
        if (unreadCount === 0) return;
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        await fetch('/api/notifications', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'mark_all_read' })
        }).catch(console.error);
    };

    const handleNotificationClick = async (notif: any) => {
        if (!notif.isRead) {
            setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
            fetch('/api/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'mark_read', id: notif.id })
            }).catch(console.error);
        }
        setIsOpen(false);
        if (notif.link) {
            router.push(notif.link);
        }
    };

    if (!session?.user) return null;

    return (
        <div className={styles.container} ref={dropdownRef}>
            <button
                className={styles.bellBtn}
                onClick={() => setIsOpen(!isOpen)}
                title="Notifications"
            >
                <Bell size={18} />
                {unreadCount > 0 && <span className={styles.badge}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </button>

            {isOpen && (
                <div className={styles.dropdown}>
                    <div className={styles.header}>
                        <span className={styles.title}>Notifications</span>
                        {unreadCount > 0 && (
                            <button className={styles.markReadBtn} onClick={markAllRead}>
                                <Check size={14} /> Mark all read
                            </button>
                        )}
                    </div>

                    <div className={styles.list}>
                        {notifications.length === 0 ? (
                            <div className={styles.empty}>No notifications yet</div>
                        ) : (
                            notifications.map(n => (
                                <div
                                    key={n.id}
                                    className={`${styles.item} ${n.isRead ? styles.read : styles.unread}`}
                                    onClick={() => handleNotificationClick(n)}
                                >
                                    <div className={styles.itemTitle}>{n.title}</div>
                                    <div className={styles.itemMessage}>{n.message}</div>
                                    <div className={styles.itemTime}>{format(new Date(n.createdAt), 'MMM d, h:mm a')}</div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
