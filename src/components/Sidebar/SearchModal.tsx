'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, FileText, CalendarDays, X } from 'lucide-react';
import styles from './SearchModal.module.css';

export default function SearchModal({ onClose }: { onClose: () => void }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-focus input on mount
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

    // Close on escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            return;
        }

        const fetchResults = async () => {
            setLoading(true);
            try {
                // In a real app we'd query multiple tables, for now we just search pages
                const res = await fetch(`/api/pages`);
                if (res.ok) {
                    const pages = await res.json();
                    const filtered = pages.filter((p: any) =>
                        p.title.toLowerCase().includes(query.toLowerCase())
                    );
                    setResults(filtered);
                }
            } catch (err) {
                console.error('Search error:', err);
            } finally {
                setLoading(false);
            }
        };

        const timeoutId = setTimeout(fetchResults, 300); // 300ms debounce
        return () => clearTimeout(timeoutId);
    }, [query]);

    const handleSelect = (pageId: string) => {
        router.push(`/page/${pageId}`);
        onClose();
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.searchHeader}>
                    <Search className={styles.searchIcon} size={20} />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search workspace..."
                        className={styles.searchInput}
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                    />
                    <button className={styles.closeBtn} onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className={styles.resultsContainer}>
                    {loading && <div className={styles.loading}>Searching...</div>}
                    {!loading && query && results.length === 0 && (
                        <div className={styles.empty}>No results found for "{query}"</div>
                    )}

                    {!loading && results.length > 0 && (
                        <div className={styles.resultsList}>
                            <div className={styles.sectionTitle}>Pages</div>
                            {results.map(page => (
                                <button
                                    key={page.id}
                                    className={styles.resultItem}
                                    onClick={() => handleSelect(page.id)}
                                >
                                    <span className={styles.resultIcon}>
                                        {page.icon ? page.icon : <FileText size={16} />}
                                    </span>
                                    <div className={styles.resultDetails}>
                                        <div className={styles.resultTitle}>{page.title}</div>
                                        <div className={styles.resultMeta}>
                                            {page.pageType === 'script_page' ? 'Script' :
                                                page.pageType === 'calendar_page' ? 'Calendar' : 'Document'}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {!query && (
                        <div className={styles.hints}>
                            <div>Type to search for pages, scripts, and calendars across your workspace.</div>
                            <div className={styles.shortcutHint}>
                                <span>Navigate with</span>
                                <kbd>↑</kbd> <kbd>↓</kbd>
                                <span>and</span>
                                <kbd>Enter</kbd>
                                <span>to select</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
