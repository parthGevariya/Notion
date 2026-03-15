'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import {
    ChevronRight, Plus, Search, Settings, Trash2,
    Star, FileText, ChevronsLeft, ChevronsRight, MoreHorizontal, LogOut, Bell, MessageSquare,
    LayoutDashboard, Pencil, X,
} from 'lucide-react';
import { ROLE_LABELS } from '@/lib/types';
import type { Role } from '@/lib/types';
import styles from './Sidebar.module.css';
import SearchModal from './SearchModal';
import { useAppSocket } from '@/lib/useAppSocket';

interface PageItem {
    id: string;
    title: string;
    icon: string | null;
    parentId: string | null;
    _count: { children: number };
}

interface FavoriteItem {
    id: string;
    page: { id: string; title: string; icon: string | null };
}

interface ClientItem {
    id: string;
    name: string;
    emoji: string | null;
    pages: { id: string; pageType: string; title: string }[];
}

export default function Sidebar() {
    const { data: session } = useSession();
    const role = (session?.user as { role?: string })?.role || 'viewer';
    const router = useRouter();
    const pathname = usePathname();
    const [pages, setPages] = useState<PageItem[]>([]);
    const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
    const [clients, setClients] = useState<ClientItem[]>([]);
    const [scriptsExpanded, setScriptsExpanded] = useState(true);
    const [calendarExpanded, setCalendarExpanded] = useState(true);
    const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());
    const [childPages, setChildPages] = useState<Record<string, PageItem[]>>({});
    const [collapsed, setCollapsed] = useState(false);
    // Page context menu state
    const [pageMenu, setPageMenu] = useState<{ pageId: string; x: number; y: number } | null>(null);
    const [renamingPageId, setRenamingPageId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const menuRef = useRef<HTMLDivElement>(null);
    const [showSearch, setShowSearch] = useState(false);
    const [chatBadge, setChatBadge] = useState<{ hasBadge: boolean; hasMention: boolean; unreadDMs: number }>({
        hasBadge: false,
        hasMention: false,
        unreadDMs: 0
    });
    const [hasUnreadReminders, setHasUnreadReminders] = useState(false);

    const currentPageId = pathname?.split('/page/')[1] || '';
    const currentUserId = (session?.user as { id?: string })?.id;

    // ── Data fetchers (declared here so socket effect can reference them) ──────
    const fetchPages = useCallback(async () => {
        try {
            const res = await fetch('/api/pages');
            if (res.ok) setPages(await res.json());
        } catch (e) {
            console.error('Failed to fetch pages:', e);
        }
    }, []);

    const fetchFavorites = useCallback(async () => {
        try {
            const res = await fetch('/api/favorites');
            if (res.ok) setFavorites(await res.json());
        } catch (e) {
            console.error('Failed to fetch favorites:', e);
        }
    }, []);

    const fetchClients = useCallback(async () => {
        try {
            const res = await fetch('/api/clients');
            if (res.ok) setClients(await res.json());
        } catch (e) {
            console.error('Failed to fetch clients:', e);
        }
    }, []);

    useEffect(() => {
        fetchPages();
        fetchFavorites();
        fetchClients();
    }, [fetchPages, fetchFavorites, fetchClients]);

    // ── Real-time Socket.IO connection ─────────────────────────────────────────
    const socket = useAppSocket();
    const currentUserIdRef = useRef<string | undefined>(undefined);
    currentUserIdRef.current = currentUserId; // keep in sync every render
    const currentPageIdRef = useRef(currentPageId);
    currentPageIdRef.current = currentPageId;

    useEffect(() => {
        if (!socket) return;

        const onPageCreated = (page: PageItem) => {
            if (page.parentId) {
                // Child page: add to the right childPages bucket
                setChildPages(prev => {
                    if (!prev[page.parentId!]) return prev; // parent not expanded, skip
                    const exists = prev[page.parentId!].some(p => p.id === page.id);
                    if (exists) return prev;
                    return { ...prev, [page.parentId!]: [...prev[page.parentId!], page] };
                });
            } else {
                // Top-level page
                setPages(prev => {
                    if (prev.some(p => p.id === page.id)) return prev;
                    return [...prev, page];
                });
            }
        };

        const onPageUpdated = (data: { id: string; title: string; icon: string | null; parentId: string | null }) => {
            setPages(prev => prev.map(p => p.id === data.id ? { ...p, title: data.title, icon: data.icon } : p));
            setChildPages(prev => {
                const next = { ...prev };
                for (const key in next) {
                    next[key] = next[key].map(p => p.id === data.id ? { ...p, title: data.title, icon: data.icon } : p);
                }
                return next;
            });
            // Update favorites section titles too
            setFavorites(prev => prev.map(fav =>
                fav.page.id === data.id ? { ...fav, page: { ...fav.page, title: data.title, icon: data.icon } } : fav
            ));
        };

        const onPageDeleted = (data: { id: string; parentId: string | null }) => {
            setPages(prev => prev.filter(p => p.id !== data.id));
            setChildPages(prev => {
                const next: Record<string, PageItem[]> = {};
                for (const key in prev) {
                    next[key] = prev[key].filter(p => p.id !== data.id);
                }
                return next;
            });
            setFavorites(prev => prev.filter(fav => fav.page.id !== data.id));
            // Redirect if viewing the deleted page
            if (currentPageIdRef.current === data.id) {
                router.push('/workspace');
            }
        };

        const onFavoriteChanged = (data: { userId: string }) => {
            // Only re-fetch favorites for the current user
            if (data.userId === currentUserIdRef.current) {
                fetchFavorites();
            }
        };

        const onClientChanged = () => {
            fetchClients();
        };

        socket.on('page-created', onPageCreated);
        socket.on('page-updated', onPageUpdated);
        socket.on('page-deleted', onPageDeleted);
        socket.on('favorite-changed', onFavoriteChanged);
        socket.on('client-changed', onClientChanged);

        return () => {
            socket.off('page-created', onPageCreated);
            socket.off('page-updated', onPageUpdated);
            socket.off('page-deleted', onPageDeleted);
            socket.off('favorite-changed', onFavoriteChanged);
            socket.off('client-changed', onClientChanged);
        };
    }, [socket, fetchFavorites, fetchClients, router]);
    // ── End real-time ──────────────────────────────────────────────────────────


    // Close page menu on click outside
    useEffect(() => {
        if (!pageMenu) return;
        const handler = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setPageMenu(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [pageMenu]);

    // Global Cmd/Ctrl + K for Search
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setShowSearch(true);
            }
        };
        document.addEventListener('keydown', handleKeyDown);

        // ── Listen for chat badges ──
        const handleChatBadge = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            setChatBadge(detail);
        };
        window.addEventListener('chat-badge-update', handleChatBadge);

        // ── Listen for app notifications (reminders) ──
        const handleNotif = () => setHasUnreadReminders(true);
        window.addEventListener('new-app-notification', handleNotif);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('chat-badge-update', handleChatBadge);
            window.removeEventListener('new-app-notification', handleNotif);
        };
    }, []);

    // Clear Reminders badge when visiting the reminders page
    useEffect(() => {
        if (pathname === '/reminders') setHasUnreadReminders(false);
    }, [pathname]);

    // Rename a page
    const renamePage = async (pageId: string, title: string) => {
        await fetch(`/api/pages/${pageId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title }),
        });
        setPages(prev => prev.map(p => p.id === pageId ? { ...p, title } : p));
        setChildPages(prev => {
            const next = { ...prev };
            for (const key in next) {
                next[key] = next[key].map(p => p.id === pageId ? { ...p, title } : p);
            }
            return next;
        });
        setRenamingPageId(null);
    };

    // Delete a page — soft-delete (move to trash) via PATCH isTrashed=true
    const deletePage = async (pageId: string) => {
        const res = await fetch(`/api/pages/${pageId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isTrashed: true }),
        });
        if (!res.ok) {
            alert('Failed to delete page');
            return;
        }
        // Remove from top-level pages
        setPages(prev => prev.filter(p => p.id !== pageId));
        // Remove from all childPages lists
        setChildPages(prev => {
            const next: Record<string, PageItem[]> = {};
            for (const key in prev) {
                next[key] = prev[key].filter(p => p.id !== pageId);
            }
            return next;
        });
        if (pageMenu?.pageId === pageId) setPageMenu(null);
        // If we're currently viewing the deleted page, go to workspace
        if (currentPageId === pageId) router.push('/workspace');
    };

    const fetchChildren = async (parentId: string) => {
        try {
            const res = await fetch(`/api/pages?parentId=${parentId}`);
            if (res.ok) {
                const data = await res.json();
                setChildPages(prev => ({ ...prev, [parentId]: data }));
            }
        } catch (e) {
            console.error('Failed to fetch children:', e);
        }
    };

    const toggleExpanded = (pageId: string, hasChildren: boolean) => {
        setExpandedPages(prev => {
            const next = new Set(prev);
            if (next.has(pageId)) {
                next.delete(pageId);
            } else {
                next.add(pageId);
                if (hasChildren && !childPages[pageId]) {
                    fetchChildren(pageId);
                }
            }
            return next;
        });
    };

    const createPage = async (parentId: string | null = null) => {
        try {
            const res = await fetch('/api/pages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ parentId }),
            });
            if (res.ok) {
                const page = await res.json();
                if (parentId) {
                    fetchChildren(parentId);
                    setExpandedPages(prev => new Set(prev).add(parentId));
                } else {
                    fetchPages();
                }
                router.push(`/page/${page.id}`);
            }
        } catch (e) {
            console.error('Failed to create page:', e);
        }
    };

    const navigateToPage = (pageId: string) => {
        router.push(`/page/${pageId}`);
    };

    const userRole = (session?.user as any)?.role as Role;
    const userName = session?.user?.name || 'User';

    const renderPageItem = (page: PageItem, depth: number = 0) => {
        const isExpanded = expandedPages.has(page.id);
        const hasChildren = page._count.children > 0;
        const isActive = currentPageId === page.id;
        const children = childPages[page.id] || [];

        return (
            <div key={page.id}>
                <div
                    className={`${styles['page-item']} ${isActive ? styles.active : ''}`}
                    style={{ paddingLeft: `${8 + depth * 12}px` }}
                    onClick={() => navigateToPage(page.id)}
                >
                    <div
                        className={`${styles['page-item-toggle']} ${isExpanded ? styles.expanded : ''} ${!hasChildren ? styles.hidden : ''}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleExpanded(page.id, hasChildren);
                        }}
                    >
                        <ChevronRight size={14} />
                    </div>
                    <span className={styles['page-item-icon']}>
                        {page.icon || <FileText size={16} />}
                    </span>
                    <span className={styles['page-item-title']}>
                        {page.title || 'Untitled'}
                    </span>
                    <div className={styles['page-item-actions']}>
                        <button
                            className={styles['page-item-action']}
                            onClick={(e) => {
                                e.stopPropagation();
                                createPage(page.id);
                            }}
                            title="Add sub-page"
                        >
                            <Plus size={14} />
                        </button>
                        <button
                            className={styles['page-item-action']}
                            title="More options"
                            onClick={(e) => {
                                e.stopPropagation();
                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                setPageMenu(prev =>
                                    prev?.pageId === page.id ? null : { pageId: page.id, x: rect.right, y: rect.bottom + 4 }
                                );
                                setRenamingPageId(null);
                            }}
                        >
                            <MoreHorizontal size={14} />
                        </button>
                    </div>
                </div>
                {/* Inline rename input */}
                {renamingPageId === page.id && (
                    <form
                        style={{ padding: '2px 8px 4px', display: 'flex', gap: 4 }}
                        onSubmit={e => { e.preventDefault(); renamePage(page.id, renameValue); }}
                    >
                        <input
                            autoFocus
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            style={{
                                flex: 1, background: 'var(--bg-tertiary)', border: '1px solid var(--accent-blue)',
                                borderRadius: 'var(--radius-sm)', padding: '3px 6px', fontSize: 13,
                                color: 'var(--text-primary)', outline: 'none',
                            }}
                            onKeyDown={e => { if (e.key === 'Escape') setRenamingPageId(null); }}
                        />
                        <button type="submit" style={{ display: 'none' }} />
                    </form>
                )}
                {isExpanded && hasChildren && (
                    <div className={styles['page-children']}>
                        {children.map(child => renderPageItem(child, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    // ── Collapsed sidebar: slim expand button ──────────────────────────────
    if (collapsed) {
        return (
            <div style={{
                position: 'fixed', left: 0, top: 0, height: '100vh',
                width: 28, zIndex: 100, display: 'flex', flexDirection: 'column',
                alignItems: 'center', paddingTop: 12,
                background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border-light)',
            }}>
                <button
                    title="Expand sidebar"
                    onClick={() => setCollapsed(false)}
                    style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 24, height: 24, borderRadius: 'var(--radius-sm)',
                        background: 'none', border: 'none', color: 'var(--text-secondary)',
                        cursor: 'pointer',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                    <ChevronsRight size={16} />
                </button>
            </div>
        );
    }

    return (
        <>
            <div className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
                {/* Header */}
                <div className={styles['sidebar-header']}>
                    <div className={styles['workspace-name']}>
                        <span className={styles['workspace-icon']}>🏠</span>
                        <span className={styles['workspace-label']}>My Workspace</span>
                    </div>
                    <button
                        className={styles['sidebar-collapse-btn']}
                        onClick={() => setCollapsed(true)}
                        title="Collapse sidebar"
                    >
                        <ChevronsLeft size={16} />
                    </button>
                </div>

                {/* Quick actions */}
                <div className={styles['sidebar-nav']}>
                    {/* Dashboard — always first, role-specific dashboard */}
                    <div
                        className={`${styles['sidebar-nav-item']} ${pathname === '/workspace' ? styles.active : ''}`}
                        onClick={() => router.push('/workspace')}
                    >
                        <LayoutDashboard size={16} />
                        <span>Dashboard</span>
                    </div>
                    <div
                        className={styles['sidebar-nav-item']}
                        onClick={() => setShowSearch(true)}
                        style={{ cursor: 'pointer' }}
                    >
                        <Search size={16} />
                        <span>Search</span>
                        {!collapsed && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)', opacity: 0.7 }}>Ctrl+K</span>}
                    </div>
                    <div
                        className={styles['sidebar-nav-item']}
                        onClick={() => router.push('/settings')}
                        style={{ cursor: 'pointer' }}
                    >
                        <Settings size={16} />
                        <span>Settings</span>
                    </div>
                    <div
                        className={`${styles['sidebar-nav-item']} ${pathname === '/reminders' ? styles.active : ''}`}
                        onClick={() => router.push('/reminders')}
                    >
                        <Bell size={16} />
                        <span>Reminders</span>
                        {hasUnreadReminders && <div className={styles['nav-badge']} />}
                    </div>

                </div>

                {/* Scrollable content */}
                <div className={styles['sidebar-content']}>

                    {/* Scripts section — all clients' script pages */}
                    <div className={styles['sidebar-section']}>
                        <div
                            className={styles['sidebar-section-header']}
                            onClick={() => setScriptsExpanded(e => !e)}
                            style={{ cursor: 'pointer' }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <ChevronRight
                                    size={12}
                                    style={{
                                        transform: scriptsExpanded ? 'rotate(90deg)' : 'none',
                                        transition: 'transform 0.15s',
                                    }}
                                />
                                <span>📝 SCRIPTS</span>
                            </div>
                        </div>
                        {scriptsExpanded && (
                            <>
                                {clients.flatMap(c => c.pages.filter(p => p.pageType === 'script_page').map(p => ({ ...p, clientName: c.name, clientEmoji: c.emoji }))).length === 0 && (
                                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '6px 24px' }}>
                                        No scripts yet
                                    </div>
                                )}
                                {clients.map(client => {
                                    const scriptPage = client.pages.find(p => p.pageType === 'script_page');
                                    if (!scriptPage) return null;
                                    return (
                                        <div
                                            key={scriptPage.id}
                                            className={`${styles['page-item']} ${currentPageId === scriptPage.id ? styles.active : ''}`}
                                            onClick={() => router.push(`/page/${scriptPage.id}`)}
                                            style={{ paddingLeft: 20 }}
                                        >
                                            <span className={styles['page-item-icon']}>{client.emoji || '🏢'}</span>
                                            <span className={styles['page-item-title']}>{client.name}</span>
                                        </div>
                                    );
                                })}
                            </>
                        )}
                    </div>

                    {/* Calendar section — all clients' calendar pages */}
                    <div className={styles['sidebar-section']}>
                        <div
                            className={styles['sidebar-section-header']}
                            onClick={() => setCalendarExpanded(e => !e)}
                            style={{ cursor: 'pointer' }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <ChevronRight
                                    size={12}
                                    style={{
                                        transform: calendarExpanded ? 'rotate(90deg)' : 'none',
                                        transition: 'transform 0.15s',
                                    }}
                                />
                                <span>📅 CALENDAR</span>
                            </div>
                        </div>
                        {calendarExpanded && (
                            <>
                                {clients.flatMap(c => c.pages.filter(p => p.pageType === 'calendar_page')).length === 0 && (
                                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '6px 24px' }}>
                                        No calendars yet
                                    </div>
                                )}
                                {clients.map(client => {
                                    const calPage = client.pages.find(p => p.pageType === 'calendar_page');
                                    if (!calPage) return null;
                                    return (
                                        <div
                                            key={calPage.id}
                                            className={`${styles['page-item']} ${currentPageId === calPage.id ? styles.active : ''}`}
                                            onClick={() => router.push(`/page/${calPage.id}`)}
                                            style={{ paddingLeft: 20 }}
                                        >
                                            <span className={styles['page-item-icon']}>{client.emoji || '🏢'}</span>
                                            <span className={styles['page-item-title']}>{client.name}</span>
                                        </div>
                                    );
                                })}
                            </>
                        )}
                    </div>

                    {/* Favorites */}
                    {favorites.length > 0 && (
                        <div className={styles['sidebar-section']}>
                            <div className={styles['sidebar-section-header']}>
                                <span>Favorites</span>
                            </div>
                            {favorites.map(fav => (
                                <div
                                    key={fav.id}
                                    className={`${styles['page-item']} ${currentPageId === fav.page.id ? styles.active : ''}`}
                                    onClick={() => navigateToPage(fav.page.id)}
                                >
                                    <span className={styles['page-item-icon']}>
                                        {fav.page.icon || <Star size={16} />}
                                    </span>
                                    <span className={styles['page-item-title']}>
                                        {fav.page.title || 'Untitled'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Pages */}
                    <div className={styles['sidebar-section']}>
                        <div className={styles['sidebar-section-header']}>
                            <span>Pages</span>
                            <button
                                className={styles['add-btn']}
                                onClick={() => createPage()}
                                title="Add page"
                            >
                                <Plus size={14} />
                            </button>
                        </div>
                        {pages.map(page => renderPageItem(page))}
                        {pages.length === 0 && (
                            <div
                                className={styles['sidebar-new-page']}
                                onClick={() => createPage()}
                            >
                                <Plus size={16} />
                                <span>Add a page</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer with user info */}
                <div className={styles['sidebar-footer']}>
                    <div className={styles['sidebar-nav-item']} onClick={() => router.push('/trash')}>
                        <Trash2 size={16} />
                        <span>Trash</span>
                    </div>
                    <div className={styles['sidebar-user']}>
                        <div className={styles['sidebar-user-avatar']}>
                            {userName[0]?.toUpperCase()}
                        </div>
                        <div className={styles['sidebar-user-info']}>
                            <div className={styles['sidebar-user-name']}>{userName}</div>
                            <div className={styles['sidebar-user-role']}>
                                {ROLE_LABELS[userRole] || userRole}
                            </div>
                        </div>
                        <button
                            className={styles['page-item-action']}
                            onClick={() => signOut({ callbackUrl: '/login' })}
                            title="Sign out"
                        >
                            <LogOut size={14} />
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Floating page context menu ── */}
            {pageMenu && (
                <div
                    ref={menuRef}
                    style={{
                        position: 'fixed',
                        top: pageMenu.y,
                        left: pageMenu.x,
                        zIndex: 999,
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                        minWidth: 160,
                        overflow: 'hidden',
                        padding: '4px 0',
                    }}
                >
                    {/* Rename */}
                    <button
                        style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            width: '100%', padding: '7px 12px', background: 'none',
                            border: 'none', cursor: 'pointer', fontSize: 13,
                            color: 'var(--text-primary)', textAlign: 'left',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                        onClick={() => {
                            const pid = pageMenu!.pageId;
                            const page = pages.find(p => p.id === pid)
                                || Object.values(childPages).flat().find(p => p.id === pid);
                            setRenameValue(page?.title || '');
                            setRenamingPageId(pid);
                            setPageMenu(null);
                        }}
                    >
                        <Pencil size={13} />
                        Rename
                    </button>

                    {/* Delete — only owner / manager */}
                    {(role === 'owner' || role === 'manager') && (
                        <button
                            style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                width: '100%', padding: '7px 12px', background: 'none',
                                border: 'none', cursor: 'pointer', fontSize: 13,
                                color: 'var(--red, #ef4444)', textAlign: 'left',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                            onClick={() => {
                                const pid = pageMenu!.pageId;
                                if (confirm('Move this page to trash?')) {
                                    deletePage(pid);
                                }
                            }}
                        >
                            <Trash2 size={13} />
                            Delete
                        </button>
                    )}
                </div>
            )}

            {showSearch && <SearchModal onClose={() => setShowSearch(false)} />}
        </>
    );
}
