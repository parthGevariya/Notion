'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { Smile, Image, MessageSquare } from 'lucide-react';
import Sidebar from '@/components/Sidebar/Sidebar';
import Topbar from '@/components/Topbar/Topbar';
import PageLoadingSkeleton from '@/components/Skeleton/PageLoadingSkeleton';
import dynamic from 'next/dynamic';

const BlockEditor = dynamic(() => import('@/components/Editor/BlockEditor'), {
    ssr: false,
    loading: () => <p style={{ color: 'var(--text-tertiary)', fontSize: '15px' }}>Loading editor...</p>,
});

const InlineDatabaseBlock = dynamic(() => import('@/components/Database/InlineDatabaseBlock'), {
    ssr: false,
    loading: () => <p style={{ color: 'var(--text-tertiary)', fontSize: '14px' }}>Loading database...</p>,
});

const ScriptPanel = dynamic(() => import('@/components/Scripts/ScriptPanel'), {
    ssr: false,
    loading: () => <p style={{ color: 'var(--text-tertiary)', fontSize: '14px' }}>Loading scripts...</p>,
});

const ScriptPageView = dynamic(() => import('@/components/Scripts/ScriptPageView'), {
    ssr: false,
    loading: () => <p style={{ color: 'var(--text-tertiary)', fontSize: '14px' }}>Loading script page...</p>,
});

const ClientCalendarView = dynamic(() => import('@/components/Calendar/ClientCalendarView'), {
    ssr: false,
    loading: () => <p style={{ color: 'var(--text-tertiary)', fontSize: '14px' }}>Loading calendar...</p>,
});

const CollabProvider = dynamic(
    () => import('@/components/Collab/CollabProvider').then(m => ({ default: m.CollabProvider })),
    { ssr: false }
);

const CollabIndicator = dynamic(
    () => import('@/components/Collab/CollabIndicator'),
    { ssr: false }
);

interface PageData {
    id: string;
    title: string;
    icon: string | null;
    coverImage: string | null;
    content: string | null;
    parentId: string | null;
    pageType: string; // 'general' | 'script_page' | 'calendar_page'
    clientId: string | null;
    client?: { id: string; name: string; emoji: string | null } | null;
    children: { id: string; title: string; icon: string | null }[];
    createdBy: { id: string; name: string; avatar: string | null };
}

export default function PageView() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const params = useParams();
    const pageId = params?.id as string;
    const [page, setPage] = useState<PageData | null>(null);
    const [loading, setLoading] = useState(true);
    const [databaseIds, setDatabaseIds] = useState<string[]>([]);
    const [showScripts, setShowScripts] = useState(false);
    const titleRef = useRef<HTMLTextAreaElement>(null);
    const saveTimerRef = useRef<NodeJS.Timeout>(undefined);

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
        }
    }, [status, router]);

    const fetchPage = useCallback(async () => {
        if (!pageId) return;
        try {
            setLoading(true);
            const res = await fetch(`/api/pages/${pageId}`);
            if (res.ok) {
                const data = await res.json();
                setPage(data);
            } else {
                router.push('/workspace');
            }
        } catch (e) {
            console.error('Failed to fetch page:', e);
        } finally {
            setLoading(false);
        }
    }, [pageId, router]);

    useEffect(() => {
        fetchPage();
    }, [fetchPage]);

    // Fetch inline databases for this page
    useEffect(() => {
        if (!pageId) return;
        fetch(`/api/databases?pageId=${pageId}`)
            .then(res => res.ok ? res.json() : [])
            .then((dbs: any[]) => setDatabaseIds(dbs.map(d => d.id)))
            .catch(() => { });
        // Auto-show scripts if page has any
        fetch(`/api/pages/${pageId}/scripts`)
            .then(res => res.ok ? res.json() : [])
            .then((scripts: any[]) => { if (scripts.length > 0) setShowScripts(true); })
            .catch(() => { });
    }, [pageId]);

    // Auto-resize title textarea
    useEffect(() => {
        const el = titleRef.current;
        if (el && page) {
            el.style.height = 'auto';
            el.style.height = el.scrollHeight + 'px';
        }
    }, [page?.title]);

    const updatePage = useCallback(async (updates: Partial<PageData>) => {
        if (!pageId) return;
        try {
            await fetch(`/api/pages/${pageId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
        } catch (e) {
            console.error('Failed to update page:', e);
        }
    }, [pageId]);

    const handleTitleChange = (value: string) => {
        setPage(prev => prev ? { ...prev, title: value } : null);

        // Debounced save
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            updatePage({ title: value });
        }, 500);
    };

    const handleContentChange = useCallback((content: string) => {
        updatePage({ content } as any);
    }, [updatePage]);

    const handleCreateDatabase = useCallback(async () => {
        if (!pageId) return;
        try {
            const res = await fetch('/api/databases', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pageId, title: 'Untitled Database' }),
            });
            if (res.ok) {
                const db = await res.json();
                setDatabaseIds(prev => [...prev, db.id]);
            }
        } catch (e) {
            console.error('Failed to create database:', e);
        }
    }, [pageId]);

    const handleDeleteDatabase = useCallback(async (dbId: string) => {
        setDatabaseIds(prev => prev.filter(id => id !== dbId));
        try {
            await fetch(`/api/databases/${dbId}`, { method: 'DELETE' });
        } catch (e) {
            console.error('Failed to delete database:', e);
        }
    }, []);

    const handleTitleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
        }
    };

    if (status === 'loading' || loading) {
        return <PageLoadingSkeleton />;
    }

    if (!session || !page) return null;

    // ── Script page type: renders ScriptPageView instead of standard editor ──
    if (page.pageType === 'script_page') {
        return (
            <div style={{ display: 'flex', minHeight: '100vh' }}>
                <Sidebar />
                <div style={{ flex: 1, marginLeft: 'var(--sidebar-width)', minHeight: '100vh' }}>
                    <Topbar page={page} />
                    <ScriptPageView
                        pageId={pageId}
                        clientName={page.client?.name}
                    />
                </div>
            </div>
        );
    }

    // ── Calendar page type: renders ClientCalendarView instead of standard editor ──
    if (page.pageType === 'calendar_page') {
        return (
            <div style={{ display: 'flex', minHeight: '100vh' }}>
                <Sidebar />
                <div style={{ flex: 1, marginLeft: 'var(--sidebar-width)', minHeight: '100vh', background: 'var(--bg-primary)' }}>
                    <Topbar page={page} />
                    <ClientCalendarView pageId={pageId} />
                </div>
            </div>
        );
    }

    // ── Standard general page ──────────────────────────────────────────────
    return (
        <CollabProvider pageId={pageId}>
            <div style={{ display: 'flex', minHeight: '100vh' }}>
                <Sidebar />
                <div style={{
                    flex: 1,
                    marginLeft: 'var(--sidebar-width)',
                    minHeight: '100vh',
                }}>
                    <Topbar page={page} />
                    <div style={{ position: 'absolute', top: '10px', right: '180px', zIndex: 50 }}>
                        <CollabIndicator />
                    </div>

                    {/* Cover Image */}
                    {page.coverImage && (
                        <div style={{
                            width: '100%', height: '280px', position: 'relative', overflow: 'hidden',
                        }}>
                            <img
                                src={page.coverImage}
                                alt="Cover"
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                        </div>
                    )}

                    {/* Page Content */}
                    <div style={{
                        maxWidth: '900px', margin: '0 auto',
                        padding: page.coverImage ? '0 96px 30vh' : '80px 96px 30vh',
                    }}>
                        {/* Page Header */}
                        <div style={{ marginBottom: '4px' }}>
                            {/* Icon */}
                            {page.icon && (
                                <div style={{
                                    fontSize: '72px', lineHeight: 1, marginBottom: '8px',
                                    cursor: 'pointer',
                                }}>
                                    {page.icon}
                                </div>
                            )}

                            {/* Controls (show on hover) */}
                            <div className="page-controls" style={{
                                display: 'flex', gap: '8px', marginBottom: '12px',
                            }}>
                                {!page.icon && (
                                    <button style={{
                                        display: 'flex', alignItems: 'center', gap: '4px',
                                        padding: '4px 8px', borderRadius: 'var(--radius-sm)',
                                        fontSize: '13px', color: 'var(--text-tertiary)',
                                        cursor: 'pointer', background: 'none', border: 'none',
                                    }} className="page-control-btn">
                                        <Smile size={14} />
                                        Add icon
                                    </button>
                                )}
                                {!page.coverImage && (
                                    <button style={{
                                        display: 'flex', alignItems: 'center', gap: '4px',
                                        padding: '4px 8px', borderRadius: 'var(--radius-sm)',
                                        fontSize: '13px', color: 'var(--text-tertiary)',
                                        cursor: 'pointer', background: 'none', border: 'none',
                                    }} className="page-control-btn">
                                        <Image size={14} />
                                        Add cover
                                    </button>
                                )}
                                <button style={{
                                    display: 'flex', alignItems: 'center', gap: '4px',
                                    padding: '4px 8px', borderRadius: 'var(--radius-sm)',
                                    fontSize: '13px', color: 'var(--text-tertiary)',
                                    cursor: 'pointer', background: 'none', border: 'none',
                                }} className="page-control-btn">
                                    <MessageSquare size={14} />
                                    Add comment
                                </button>
                            </div>

                            {/* Title */}
                            <textarea
                                ref={titleRef}
                                value={page.title}
                                onChange={(e) => handleTitleChange(e.target.value)}
                                onKeyDown={handleTitleKeyDown}
                                placeholder="Untitled"
                                rows={1}
                                style={{
                                    fontSize: '40px', fontWeight: 700, lineHeight: 1.2,
                                    border: 'none', outline: 'none', width: '100%',
                                    background: 'transparent', color: 'var(--text-primary)',
                                    padding: 0, resize: 'none', fontFamily: 'var(--font-sans)',
                                    overflow: 'hidden',
                                }}
                            />
                        </div>

                        {/* Block Editor */}
                        <BlockEditor
                            content={page.content}
                            onChange={handleContentChange}
                            onCreateDatabase={handleCreateDatabase}
                            onCreateScriptPanel={() => setShowScripts(true)}
                        />

                        {/* Inline Databases */}
                        {databaseIds.map(dbId => (
                            <InlineDatabaseBlock
                                key={dbId}
                                databaseId={dbId}
                                pageId={pageId}
                                onDelete={() => handleDeleteDatabase(dbId)}
                            />
                        ))}

                        {/* Script Panel */}
                        {showScripts && <ScriptPanel pageId={pageId} />}

                        {/* Sub-pages list */}
                        {page.children.length > 0 && (
                            <div style={{ marginTop: '24px', borderTop: '1px solid var(--divider)', paddingTop: '16px' }}>
                                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '8px', textTransform: 'uppercase' }}>Sub-pages</div>
                                {page.children.map(child => (
                                    <div
                                        key={child.id}
                                        onClick={() => router.push(`/page/${child.id}`)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '8px',
                                            padding: '6px 8px', borderRadius: 'var(--radius-sm)',
                                            cursor: 'pointer', fontSize: '14px',
                                            color: 'var(--text-secondary)', marginBottom: '2px',
                                            transition: 'background 0.08s',
                                        }}
                                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                    >
                                        <span style={{ fontSize: '16px' }}>
                                            {child.icon || '📄'}
                                        </span>
                                        {child.title || 'Untitled'}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </CollabProvider>
    );
}
