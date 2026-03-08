'use client';

/**
 * ScriptTOC — Floating auto-generated Table of Contents panel
 * Extracted from H1 headings in the TipTap editor.
 * Hidden by default; revealed by hovering the right edge handle.
 */

import { useCallback } from 'react';
import styles from './ScriptTOC.module.css';

export interface TocHeading {
    id: string;     // slugified text
    text: string;   // display text
    number: number; // 1-based position
}

interface ScriptTOCProps {
    headings: TocHeading[];
    activeId?: string;
}

function scrollToHeading(headingId: string) {
    const el = document.getElementById(`script-h1-${headingId}`);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

export default function ScriptTOC({ headings, activeId }: ScriptTOCProps) {
    const handleClick = useCallback((id: string) => {
        scrollToHeading(id);
    }, []);

    return (
        <div className={styles.tocOuter}>
            {/* Slim handle — always visible */}
            {/* Slim handle — always visible as a "minimap" ruler */}
            <div className={styles.handle}>
                <div className={styles.notchContainer}>
                    {headings.length > 0 ? (
                        headings.map(h => (
                            <div 
                                key={`notch-${h.id}`} 
                                className={`${styles.notch} ${activeId === h.id ? styles.notchActive : ''}`} 
                            />
                        ))
                    ) : (
                        // Fallback notches if no headings yet
                        [1, 2, 3, 4, 5].map(i => <div key={i} className={styles.notch} />)
                    )}
                </div>
            </div>

            {/* Expanded panel — revealed on hover */}
            <div className={styles.panel}>
                <div className={styles.panelHeader}>
                    <span className={styles.panelTitle}>Scripts</span>
                    <span className={styles.panelCount}>{headings.length}</span>
                </div>
                <nav className={styles.navList}>
                    {headings.length === 0 ? (
                        <p className={styles.empty}>No scripts yet.<br />Type a heading (H1) to start.</p>
                    ) : (
                        headings.map(h => (
                            <button
                                key={h.id}
                                className={`${styles.navItem} ${activeId === h.id ? styles.navItemActive : ''}`}
                                onClick={() => handleClick(h.id)}
                                title={h.text}
                            >
                                <span className={styles.navNum}>{h.number}</span>
                                <span className={styles.navText}>{h.text}</span>
                            </button>
                        ))
                    )}
                </nav>
            </div>
        </div>
    );
}
