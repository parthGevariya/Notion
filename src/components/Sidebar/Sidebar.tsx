'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import {
    ChevronRight, Plus, Search, Settings, Trash2,
    Star, FileText, ChevronsLeft, MoreHorizontal, LogOut, Bell, MessageSquare
} from 'lucide-react';
import { ROLE_LABELS } from '@/lib/types';
import type { Role } from '@/lib/types';
import styles from './Sidebar.module.css';

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

export default function Sidebar() {
    const { data: session } = useSession();
    const router = useRouter();
    const pathname = usePathname();
    const [pages, setPages] = useState<PageItem[]>([]);
    const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
    const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());
    const [childPages, setChildPages] = useState<Record<string, PageItem[]>>({});
    const [collapsed, setCollapsed] = useState(false);

    const currentPageId = pathname?.split('/page/')[1] || '';

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

    useEffect(() => {
        fetchPages();
        fetchFavorites();
    }, [fetchPages, fetchFavorites]);

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
                        <button className={styles['page-item-action']} title="More">
                            <MoreHorizontal size={14} />
                        </button>
                    </div>
                </div>
                {isExpanded && hasChildren && (
                    <div className={styles['page-children']}>
                        {children.map(child => renderPageItem(child, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    if (collapsed) {
        return null; // Will add collapsed sidebar toggle later
    }

    return (
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
                <div
                    className={styles['sidebar-nav-item']}
                    onClick={() => router.push('/search')}
                >
                    <Search size={16} />
                    <span>Search</span>
                </div>
                <div
                    className={styles['sidebar-nav-item']}
                    onClick={() => router.push('/settings')}
                >
                    <Settings size={16} />
                    <span>Settings</span>
                </div>
                <div
                    className={styles['sidebar-nav-item']}
                    onClick={() => router.push('/reminders')}
                >
                    <Bell size={16} />
                    <span>Reminders</span>
                </div>
                <div
                    className={styles['sidebar-nav-item']}
                    onClick={() => router.push('/chat')}
                >
                    <MessageSquare size={16} />
                    <span>Chat</span>
                </div>
            </div>

            {/* Scrollable content */}
            <div className={styles['sidebar-content']}>
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
    );
}
