'use client';

/**
 * ContentWriterDashboard
 * Assigned scripts, pending tasks, writing shortcuts.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PenTool, CheckSquare, Clock, FileText } from 'lucide-react';
import styles from './Dashboard.module.css';

export default function ContentWriterDashboard({ userName, userId }: { userName: string; userId: string }) {
    const router = useRouter();
    const [myTasks, setMyTasks] = useState<{
        id: string; title: string; endDate: string; status: string;
    }[]>([]);
    const [recentPages, setRecentPages] = useState<{ id: string; title: string; icon: string | null }[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const [remindersRes, pagesRes] = await Promise.all([
                    fetch('/api/reminders'),
                    fetch('/api/pages'),
                ]);
                const reminders = remindersRes.ok ? await remindersRes.json() : [];
                const pages = pagesRes.ok ? await pagesRes.json() : [];

                // Filter tasks assigned to me
                const mine = reminders.filter((r: { assigneeId: string; status: string }) =>
                    r.assigneeId === userId && r.status !== 'completed'
                );
                setMyTasks(mine.slice(0, 6));
                setRecentPages(pages.slice(0, 5));
            } catch (e) {
                console.error('Dashboard load error:', e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [userId]);

    const getDeadlineBadge = (endDate: string) => {
        const hours = (new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60);
        if (hours < 0) return { label: 'Overdue', cls: styles.badgeRed };
        if (hours < 24) return { label: 'Due soon', cls: styles.badgeYellow };
        return { label: 'On track', cls: styles.badgeGreen };
    };

    return (
        <div className={styles.dashboard}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <span className={styles.greeting}>Ready to create,</span>
                    <h1 className={styles.title}>
                        {userName} ✍️
                        <span className={`${styles.roleChip} ${styles.roleWriter}`}>Content Writer</span>
                    </h1>
                </div>
            </div>

            {/* Stats */}
            <div className={styles.statsRow}>
                <div className={styles.statCard}>
                    <span className={styles.statLabel}><Clock size={14} /> My Tasks</span>
                    <span className={styles.statValue}>{loading ? '—' : myTasks.length}</span>
                    <span className={styles.statSub}>Pending tasks</span>
                </div>
                <div className={styles.statCard}>
                    <span className={styles.statLabel}><FileText size={14} /> Pages</span>
                    <span className={styles.statValue}>{loading ? '—' : recentPages.length}</span>
                    <span className={styles.statSub}>Workspace pages</span>
                </div>
            </div>

            {/* Quick actions */}
            <div className={styles.section}>
                <div className={styles.sectionHeader}>
                    <span className={styles.sectionTitle}><PenTool size={13} /> Quick Actions</span>
                </div>
                <div className={styles.quickLinks}>
                    <div className={styles.quickCard} onClick={() => router.push('/search')}>
                        <div className={styles.quickCardIcon} style={{ background: 'var(--tag-orange)' }}>
                            <FileText size={18} color="var(--tag-orange-text)" />
                        </div>
                        <div className={styles.quickCardText}>
                            <span className={styles.quickCardTitle}>Browse Scripts</span>
                            <span className={styles.quickCardDesc}>All client pages</span>
                        </div>
                    </div>
                    <div className={styles.quickCard} onClick={() => router.push('/reminders')}>
                        <div className={styles.quickCardIcon} style={{ background: 'var(--tag-blue)' }}>
                            <CheckSquare size={18} color="var(--tag-blue-text)" />
                        </div>
                        <div className={styles.quickCardText}>
                            <span className={styles.quickCardTitle}>My Tasks</span>
                            <span className={styles.quickCardDesc}>View assigned tasks</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Two column */}
            <div className={styles.twoCol}>
                {/* My tasks */}
                <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <span className={styles.sectionTitle}><CheckSquare size={13} /> My Tasks</span>
                        <span className={styles.sectionAction} onClick={() => router.push('/reminders')}>View all</span>
                    </div>
                    <div className={styles.listCard}>
                        {loading && <div className={styles.emptyState}>Loading…</div>}
                        {!loading && myTasks.length === 0 && (
                            <div className={styles.emptyState}>No tasks assigned 🎉</div>
                        )}
                        {myTasks.map(t => {
                            const badge = getDeadlineBadge(t.endDate);
                            return (
                                <div key={t.id} className={styles.listItem} onClick={() => router.push('/reminders')}>
                                    <div className={styles.listItemMain}>
                                        <div className={styles.listItemTitle}>{t.title}</div>
                                        <div className={styles.listItemSub}>{new Date(t.endDate).toLocaleDateString()}</div>
                                    </div>
                                    <span className={`${styles.badge} ${badge.cls}`}>{badge.label}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Recent pages */}
                <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <span className={styles.sectionTitle}><FileText size={13} /> Recent Pages</span>
                        <span className={styles.sectionAction} onClick={() => router.push('/search')}>Browse</span>
                    </div>
                    <div className={styles.listCard}>
                        {loading && <div className={styles.emptyState}>Loading…</div>}
                        {!loading && recentPages.length === 0 && <div className={styles.emptyState}>No pages yet</div>}
                        {recentPages.map(p => (
                            <div key={p.id} className={styles.listItem} onClick={() => router.push(`/page/${p.id}`)}>
                                <div className={styles.listItemIcon} style={{ background: 'var(--bg-tertiary)', fontSize: 16 }}>
                                    {p.icon || '📄'}
                                </div>
                                <div className={styles.listItemMain}>
                                    <div className={styles.listItemTitle}>{p.title || 'Untitled'}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
