'use client';

/**
 * ManagerDashboard
 * Team tasks, client overview, assign tasks shortcut.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, CheckSquare, Clock, FileText, BarChart2, AlertCircle } from 'lucide-react';
import styles from './Dashboard.module.css';

export default function ManagerDashboard({ userName }: { userName: string }) {
    const router = useRouter();
    const [stats, setStats] = useState({ totalPages: 0, pendingTasks: 0, completedTasks: 0, inProgress: 0 });
    const [pendingReminders, setPendingReminders] = useState<{
        id: string; title: string; assignee?: { name: string }; endDate: string; status: string;
    }[]>([]);
    const [recentPages, setRecentPages] = useState<{ id: string; title: string; icon: string | null }[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const [pagesRes, remindersRes] = await Promise.all([
                    fetch('/api/pages'),
                    fetch('/api/reminders'),
                ]);
                const pages = pagesRes.ok ? await pagesRes.json() : [];
                const reminders = remindersRes.ok ? await remindersRes.json() : [];

                const pending = reminders.filter((r: { status: string }) => r.status === 'pending');
                const inProg = reminders.filter((r: { status: string }) => r.status === 'in_progress');
                const done = reminders.filter((r: { status: string }) => r.status === 'completed');

                setStats({ totalPages: pages.length, pendingTasks: pending.length, completedTasks: done.length, inProgress: inProg.length });
                setPendingReminders([...pending, ...inProg].slice(0, 6));
                setRecentPages(pages.slice(0, 5));
            } catch (e) {
                console.error('Dashboard load error:', e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const getDeadlineBadge = (endDate: string, status: string) => {
        if (status === 'in_progress') return { label: 'In Progress', cls: styles.badgeBlue };
        const hours = (new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60);
        if (hours < 0) return { label: 'Overdue', cls: styles.badgeRed };
        if (hours < 24) return { label: 'Due soon', cls: styles.badgeYellow };
        return { label: 'Pending', cls: styles.badgeGray };
    };

    return (
        <div className={styles.dashboard}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <span className={styles.greeting}>Welcome back,</span>
                    <h1 className={styles.title}>
                        {userName} 📋
                        <span className={`${styles.roleChip} ${styles.roleManager}`}>Manager</span>
                    </h1>
                </div>
            </div>

            {/* Stats */}
            <div className={styles.statsRow}>
                <div className={styles.statCard}>
                    <span className={styles.statLabel}><FileText size={14} /> Pages</span>
                    <span className={styles.statValue}>{loading ? '—' : stats.totalPages}</span>
                    <span className={styles.statSub}>Workspace pages</span>
                </div>
                <div className={styles.statCard}>
                    <span className={styles.statLabel}><AlertCircle size={14} /> Pending</span>
                    <span className={styles.statValue}>{loading ? '—' : stats.pendingTasks}</span>
                    <span className={styles.statSub}>Tasks waiting</span>
                </div>
                <div className={styles.statCard}>
                    <span className={styles.statLabel}><Clock size={14} /> In Progress</span>
                    <span className={styles.statValue}>{loading ? '—' : stats.inProgress}</span>
                    <span className={styles.statSub}>Active tasks</span>
                </div>
                <div className={styles.statCard}>
                    <span className={styles.statLabel}><BarChart2 size={14} /> Completed</span>
                    <span className={styles.statValue}>{loading ? '—' : stats.completedTasks}</span>
                    <span className={styles.statSub}>Tasks done</span>
                </div>
            </div>

            {/* Quick Actions */}
            <div className={styles.section}>
                <div className={styles.sectionHeader}>
                    <span className={styles.sectionTitle}><BarChart2 size={13} /> Quick Actions</span>
                </div>
                <div className={styles.quickLinks}>
                    <div className={styles.quickCard} onClick={() => router.push('/reminders')}>
                        <div className={styles.quickCardIcon} style={{ background: 'var(--tag-blue)' }}>
                            <CheckSquare size={18} color="var(--tag-blue-text)" />
                        </div>
                        <div className={styles.quickCardText}>
                            <span className={styles.quickCardTitle}>Assign Task</span>
                            <span className={styles.quickCardDesc}>Delegate to team</span>
                        </div>
                    </div>
                    <div className={styles.quickCard} onClick={() => router.push('/settings')}>
                        <div className={styles.quickCardIcon} style={{ background: 'var(--tag-purple)' }}>
                            <Users size={18} color="var(--tag-purple-text)" />
                        </div>
                        <div className={styles.quickCardText}>
                            <span className={styles.quickCardTitle}>Team Members</span>
                            <span className={styles.quickCardDesc}>View &amp; manage</span>
                        </div>
                    </div>
                    <div className={styles.quickCard} onClick={() => router.push('/search')}>
                        <div className={styles.quickCardIcon} style={{ background: 'var(--tag-green)' }}>
                            <FileText size={18} color="var(--tag-green-text)" />
                        </div>
                        <div className={styles.quickCardText}>
                            <span className={styles.quickCardTitle}>All Pages</span>
                            <span className={styles.quickCardDesc}>Browse content</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Two column */}
            <div className={styles.twoCol}>
                <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <span className={styles.sectionTitle}><Clock size={13} /> Team Tasks</span>
                        <span className={styles.sectionAction} onClick={() => router.push('/reminders')}>View all</span>
                    </div>
                    <div className={styles.listCard}>
                        {loading && <div className={styles.emptyState}>Loading…</div>}
                        {!loading && pendingReminders.length === 0 && (
                            <div className={styles.emptyState}>All tasks completed! 🎉</div>
                        )}
                        {pendingReminders.map(r => {
                            const badge = getDeadlineBadge(r.endDate, r.status);
                            return (
                                <div key={r.id} className={styles.listItem} onClick={() => router.push('/reminders')}>
                                    <div className={styles.listItemMain}>
                                        <div className={styles.listItemTitle}>{r.title}</div>
                                        <div className={styles.listItemSub}>
                                            {r.assignee?.name || 'Unassigned'} · {new Date(r.endDate).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <span className={`${styles.badge} ${badge.cls}`}>{badge.label}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <span className={styles.sectionTitle}><FileText size={13} /> Recent Pages</span>
                        <span className={styles.sectionAction} onClick={() => router.push('/search')}>View all</span>
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
