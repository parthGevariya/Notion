'use client';

/**
 * OwnerDashboard
 * Full admin view: team overview, all tasks, client pages, user management.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, FileText, CheckSquare, Settings, Plus,
  TrendingUp, AlertCircle, Clock, BarChart2,
} from 'lucide-react';
import styles from './Dashboard.module.css';

interface StatsData {
  totalUsers: number;
  totalPages: number;
  pendingTasks: number;
  completedTasks: number;
}

export default function OwnerDashboard({ userName }: { userName: string }) {
  const router = useRouter();
  const [stats, setStats] = useState<StatsData>({ totalUsers: 0, totalPages: 0, pendingTasks: 0, completedTasks: 0 });
  const [recentPages, setRecentPages] = useState<{ id: string; title: string; icon: string | null; updatedAt: string }[]>([]);
  const [pendingReminders, setPendingReminders] = useState<{
    id: string; title: string; assignee?: { name: string }; endDate: string; status: string;
  }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [pagesRes, remindersRes, usersRes] = await Promise.all([
          fetch('/api/pages'),
          fetch('/api/reminders'),
          fetch('/api/users'),
        ]);

        const pages = pagesRes.ok ? await pagesRes.json() : [];
        const reminders = remindersRes.ok ? await remindersRes.json() : [];
        const users = usersRes.ok ? await usersRes.json() : [];

        const pending = reminders.filter((r: { status: string }) => r.status === 'pending' || r.status === 'in_progress');
        const done = reminders.filter((r: { status: string }) => r.status === 'completed');

        setStats({
          totalUsers: users.length,
          totalPages: pages.length,
          pendingTasks: pending.length,
          completedTasks: done.length,
        });
        setRecentPages(pages.slice(0, 5));
        setPendingReminders(pending.slice(0, 6));
      } catch (e) {
        console.error('Dashboard load error:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const getDeadlineBadge = (endDate: string) => {
    const diff = new Date(endDate).getTime() - Date.now();
    const hours = diff / (1000 * 60 * 60);
    if (hours < 0) return { label: 'Overdue', cls: styles.badgeRed };
    if (hours < 24) return { label: 'Due soon', cls: styles.badgeYellow };
    return { label: 'On track', cls: styles.badgeGreen };
  };

  return (
    <div className={styles.dashboard}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.greeting}>Good to see you,</span>
          <h1 className={styles.title}>
            {userName} 👑
            <span className={`${styles.roleChip} ${styles.roleOwner}`}>Owner</span>
          </h1>
        </div>
      </div>

      {/* Stats */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}><Users size={14} /> Team Members</span>
          <span className={styles.statValue}>{loading ? '—' : stats.totalUsers}</span>
          <span className={styles.statSub}>Active employees</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}><FileText size={14} /> Total Pages</span>
          <span className={styles.statValue}>{loading ? '—' : stats.totalPages}</span>
          <span className={styles.statSub}>In the workspace</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}><AlertCircle size={14} /> Pending Tasks</span>
          <span className={styles.statValue}>{loading ? '—' : stats.pendingTasks}</span>
          <span className={styles.statSub}>Across all team</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}><TrendingUp size={14} /> Completed</span>
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
          <div className={styles.quickCard} onClick={() => router.push('/settings')}>
            <div className={styles.quickCardIcon} style={{ background: 'var(--tag-purple)' }}>
              <Users size={18} color="var(--tag-purple-text)" />
            </div>
            <div className={styles.quickCardText}>
              <span className={styles.quickCardTitle}>Manage Users</span>
              <span className={styles.quickCardDesc}>Roles &amp; permissions</span>
            </div>
          </div>
          <div className={styles.quickCard} onClick={() => router.push('/reminders')}>
            <div className={styles.quickCardIcon} style={{ background: 'var(--tag-blue)' }}>
              <CheckSquare size={18} color="var(--tag-blue-text)" />
            </div>
            <div className={styles.quickCardText}>
              <span className={styles.quickCardTitle}>All Tasks</span>
              <span className={styles.quickCardDesc}>Assign &amp; review</span>
            </div>
          </div>
          <div className={styles.quickCard} onClick={() => router.push('/settings')}>
            <div className={styles.quickCardIcon} style={{ background: 'var(--tag-gray)' }}>
              <Settings size={18} color="var(--tag-gray-text)" />
            </div>
            <div className={styles.quickCardText}>
              <span className={styles.quickCardTitle}>Settings</span>
              <span className={styles.quickCardDesc}>Workspace settings</span>
            </div>
          </div>
          <div className={styles.quickCard} onClick={() => router.push('/workspace')}>
            <div className={styles.quickCardIcon} style={{ background: 'var(--tag-green)' }}>
              <Plus size={18} color="var(--tag-green-text)" />
            </div>
            <div className={styles.quickCardText}>
              <span className={styles.quickCardTitle}>New Page</span>
              <span className={styles.quickCardDesc}>Create content</span>
            </div>
          </div>
        </div>
      </div>

      {/* Two column: recent pages + pending tasks */}
      <div className={styles.twoCol}>
        {/* Recent pages */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}><FileText size={13} /> Recent Pages</span>
            <span className={styles.sectionAction} onClick={() => router.push('/search')}>View all</span>
          </div>
          <div className={styles.listCard}>
            {loading && <div className={styles.emptyState}>Loading…</div>}
            {!loading && recentPages.length === 0 && (
              <div className={styles.emptyState}>No pages yet</div>
            )}
            {recentPages.map(p => (
              <div key={p.id} className={styles.listItem} onClick={() => router.push(`/page/${p.id}`)}>
                <div className={styles.listItemIcon} style={{ background: 'var(--bg-tertiary)', fontSize: 16 }}>
                  {p.icon || '📄'}
                </div>
                <div className={styles.listItemMain}>
                  <div className={styles.listItemTitle}>{p.title || 'Untitled'}</div>
                  <div className={styles.listItemSub}>{new Date(p.updatedAt).toLocaleDateString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pending tasks */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}><Clock size={13} /> Pending Tasks</span>
            <span className={styles.sectionAction} onClick={() => router.push('/reminders')}>View all</span>
          </div>
          <div className={styles.listCard}>
            {loading && <div className={styles.emptyState}>Loading…</div>}
            {!loading && pendingReminders.length === 0 && (
              <div className={styles.emptyState}>No pending tasks 🎉</div>
            )}
            {pendingReminders.map(r => {
              const badge = getDeadlineBadge(r.endDate);
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
      </div>
    </div>
  );
}
