'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Search as SearchIcon, Clock } from 'lucide-react';

interface SearchResult {
    id: string;
    title: string;
    icon: string | null;
    updatedAt: string;
    createdBy: { name: string };
    parent: { id: string; title: string } | null;
}

export default function SearchPage() {
    const { data: session, status: authStatus } = useSession();
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const searchTimer = useRef<NodeJS.Timeout>(undefined);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (authStatus === 'unauthenticated') router.push('/login');
    }, [authStatus, router]);

    useEffect(() => { inputRef.current?.focus(); }, []);

    const doSearch = useCallback(async (q: string) => {
        if (q.trim().length < 2) { setResults([]); return; }
        setLoading(true);
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        if (res.ok) setResults(await res.json());
        setLoading(false);
    }, []);

    const handleInput = (val: string) => {
        setQuery(val);
        if (searchTimer.current) clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => doSearch(val), 300);
    };

    const formatDate = (d: string) =>
        new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

    if (authStatus === 'loading') {
        return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-secondary)' }}>Loading...</div>;
    }

    if (!session) return null;

    return (
        <div style={{ flex: 1, marginLeft: 'var(--sidebar-width)', minHeight: '100vh' }}>
            <div style={{ maxWidth: 700, margin: '0 auto', padding: '60px 32px' }}>
                {/* Search bar */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '14px 20px', border: '1px solid var(--divider)',
                    borderRadius: '8px', background: 'var(--bg-secondary)', marginBottom: '24px',
                }}>
                    <SearchIcon size={20} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={e => handleInput(e.target.value)}
                        placeholder="Search pages..."
                        style={{
                            flex: 1, border: 'none', outline: 'none', background: 'transparent',
                            color: 'var(--text-primary)', fontSize: '16px', fontFamily: 'inherit',
                        }}
                    />
                    {loading && <span style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>Searching...</span>}
                </div>

                {/* Results */}
                {query.trim().length >= 2 && (
                    <div>
                        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            {results.length} result{results.length !== 1 ? 's' : ''}
                        </div>
                        {results.map(page => (
                            <div
                                key={page.id}
                                onClick={() => router.push(`/page/${page.id}`)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '12px',
                                    padding: '12px 16px', borderRadius: '6px', cursor: 'pointer',
                                    marginBottom: '4px', transition: 'background 0.05s',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                                <span style={{ fontSize: '20px' }}>{page.icon || '📄'}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                                        {page.title || 'Untitled'}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '12px', color: 'var(--text-tertiary)' }}>
                                        {page.parent && (
                                            <span>In: {page.parent.title || 'Untitled'}</span>
                                        )}
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                            <Clock size={11} /> {formatDate(page.updatedAt)}
                                        </span>
                                        <span>by {page.createdBy.name}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {results.length === 0 && !loading && (
                            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '14px' }}>
                                No pages found matching &quot;{query}&quot;
                            </div>
                        )}
                    </div>
                )}

                {query.trim().length < 2 && (
                    <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '14px' }}>
                        <SearchIcon size={48} style={{ marginBottom: 16, opacity: 0.2 }} />
                        <div>Type at least 2 characters to search</div>
                    </div>
                )}
            </div>
        </div>
    );
}
