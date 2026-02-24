'use client';

import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';

interface SlashMenuItem {
    title: string;
    description: string;
    icon: string;
    command: string;
    group: string;
}

const SLASH_ITEMS: SlashMenuItem[] = [
    // Basic blocks
    { title: 'Text', description: 'Plain text block', icon: 'Aa', command: 'paragraph', group: 'Basic' },
    { title: 'Heading 1', description: 'Large section heading', icon: 'H1', command: 'h1', group: 'Basic' },
    { title: 'Heading 2', description: 'Medium section heading', icon: 'H2', command: 'h2', group: 'Basic' },
    { title: 'Heading 3', description: 'Small section heading', icon: 'H3', command: 'h3', group: 'Basic' },

    // Lists
    { title: 'Bullet List', description: 'Unordered list', icon: '•', command: 'bulletList', group: 'Lists' },
    { title: 'Numbered List', description: 'Ordered list', icon: '1.', command: 'orderedList', group: 'Lists' },
    { title: 'To-do List', description: 'Checkbox list', icon: '☑', command: 'taskList', group: 'Lists' },

    // Advanced
    { title: 'Quote', description: 'Capture a quote', icon: '"', command: 'blockquote', group: 'Advanced' },
    { title: 'Divider', description: 'Visual line separator', icon: '—', command: 'divider', group: 'Advanced' },
    { title: 'Code', description: 'Code block with syntax', icon: '</>', command: 'codeBlock', group: 'Advanced' },
    { title: 'Callout', description: 'Highlighted text block', icon: '💡', command: 'callout', group: 'Advanced' },
    { title: 'Table - Inline', description: 'Add a database table', icon: '🗃️', command: 'inlineDatabase', group: 'Advanced' },
    { title: 'Scripts', description: 'Add script panel', icon: '📝', command: 'scriptPanel', group: 'Advanced' },
];

interface Props {
    position: { top: number; left: number } | null;
    onSelect: (command: string) => void;
    onClose: () => void;
}

const SlashCommandMenu = forwardRef<HTMLDivElement, Props>(({ position, onSelect, onClose }, ref) => {
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const menuRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => menuRef.current!);

    const filtered = SLASH_ITEMS.filter(
        item =>
            item.title.toLowerCase().includes(query.toLowerCase()) ||
            item.description.toLowerCase().includes(query.toLowerCase())
    );

    // Group filtered items
    const groups: Record<string, SlashMenuItem[]> = {};
    filtered.forEach(item => {
        if (!groups[item.group]) groups[item.group] = [];
        groups[item.group].push(item);
    });

    useEffect(() => {
        setActiveIndex(0);
    }, [query]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (!position) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex(i => (i + 1) % filtered.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex(i => (i - 1 + filtered.length) % filtered.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filtered[activeIndex]) {
                onSelect(filtered[activeIndex].command);
            }
        } else if (e.key === 'Escape') {
            onClose();
        }
    }, [position, filtered, activeIndex, onSelect, onClose]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown, true);
        return () => document.removeEventListener('keydown', handleKeyDown, true);
    }, [handleKeyDown]);

    if (!position || filtered.length === 0) return null;

    let flatIndex = 0;

    return (
        <div
            ref={menuRef}
            className="slash-menu"
            style={{ top: position.top, left: position.left }}
        >
            {Object.entries(groups).map(([groupName, items]) => (
                <div key={groupName}>
                    <div className="slash-menu-group-label">{groupName}</div>
                    {items.map(item => {
                        const idx = flatIndex++;
                        return (
                            <div
                                key={item.command}
                                className={`slash-menu-item ${idx === activeIndex ? 'active' : ''}`}
                                onClick={() => onSelect(item.command)}
                                onMouseEnter={() => setActiveIndex(idx)}
                            >
                                <div className="slash-menu-item-icon">{item.icon}</div>
                                <div className="slash-menu-item-content">
                                    <div className="slash-menu-item-title">{item.title}</div>
                                    <div className="slash-menu-item-desc">{item.description}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
});

SlashCommandMenu.displayName = 'SlashCommandMenu';

export { SlashCommandMenu, SLASH_ITEMS };
export type { SlashMenuItem };
