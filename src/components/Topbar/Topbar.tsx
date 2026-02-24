'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    ChevronRight, Share, Star, MoreHorizontal,
    Menu, MessageSquare
} from 'lucide-react';
import styles from './Topbar.module.css';
import ThemeToggle from '@/components/Theme/ThemeToggle';
import { useI18n } from '@/lib/i18n';

interface TopbarProps {
    page?: {
        id: string;
        title: string;
        icon: string | null;
    } | null;
    breadcrumbs?: { id: string; title: string; icon: string | null }[];
    onToggleSidebar?: () => void;
    sidebarCollapsed?: boolean;
}

export default function Topbar({
    page,
    breadcrumbs = [],
    onToggleSidebar,
    sidebarCollapsed,
}: TopbarProps) {
    const router = useRouter();
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 0);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const toggleFavorite = async () => {
        if (!page) return;
        await fetch('/api/favorites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pageId: page.id }),
        });
    };

    return (
        <div className={`${styles.topbar} ${scrolled ? styles.scrolled : ''}`}>
            <div className={styles['topbar-left']}>
                {sidebarCollapsed && (
                    <button
                        className={styles['sidebar-open-btn']}
                        onClick={onToggleSidebar}
                    >
                        <Menu size={16} />
                    </button>
                )}

                <div className={styles.breadcrumbs}>
                    {breadcrumbs.map((crumb, i) => (
                        <span key={crumb.id} style={{ display: 'flex', alignItems: 'center' }}>
                            {i > 0 && (
                                <span className={styles['breadcrumb-separator']}>
                                    <ChevronRight size={12} />
                                </span>
                            )}
                            <span
                                className={styles['breadcrumb-item']}
                                onClick={() => router.push(`/page/${crumb.id}`)}
                            >
                                {crumb.icon && (
                                    <span className={styles['breadcrumb-icon']}>{crumb.icon}</span>
                                )}
                                {crumb.title || 'Untitled'}
                            </span>
                        </span>
                    ))}
                    {page && breadcrumbs.length === 0 && (
                        <span className={styles['breadcrumb-item']}>
                            {page.icon && (
                                <span className={styles['breadcrumb-icon']}>{page.icon}</span>
                            )}
                            {page.title || 'Untitled'}
                        </span>
                    )}
                </div>
            </div>

            <div className={styles['topbar-right']}>
                <ThemeToggle />
                <LangToggle />
                {page && (
                    <>
                        <button className={styles['topbar-btn']} onClick={toggleFavorite} title="Add to favorites">
                            <Star size={16} />
                        </button>
                        <button className={styles['topbar-btn']} title="Comments">
                            <MessageSquare size={16} />
                        </button>
                        <button className={styles['topbar-btn']} title="More options">
                            <MoreHorizontal size={16} />
                        </button>
                        <button className={`${styles['topbar-btn']} ${styles.share}`}>
                            Share
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

function LangToggle() {
    const { locale, setLocale } = useI18n();
    return (
        <button
            onClick={() => setLocale(locale === 'en' ? 'hi' : 'en')}
            title={locale === 'en' ? 'हिन्दी में बदलें' : 'Switch to English'}
            style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 28, height: 28, border: 'none', background: 'transparent',
                color: 'var(--text-secondary)', cursor: 'pointer', borderRadius: 4,
                fontSize: 11, fontWeight: 700, transition: 'background 0.08s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
            {locale === 'en' ? 'HI' : 'EN'}
        </button>
    );
}
