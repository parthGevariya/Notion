'use client';

/**
 * ScriptPageView — Full-page view for a client's script page
 * Features:
 *   • Script list with status chips
 *   • TipTap editor per-script with collaborative block locking
 *   • Block-lock indicator overlay when another user is writing
 *   • Google Docs sync button (stub — shows "Coming Soon" until API key)
 *   • Fullscreen toggle for the editor
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import io from 'socket.io-client';
import { Plus, Trash2, ExternalLink, RefreshCw, Maximize2, Minimize2, Lock, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import styles from './ScriptPageView.module.css';

// Lazy-load TipTap to avoid SSR issues
import type { TipTapScriptEditorProps } from './TipTapScriptEditor';
const TipTapScriptEditor = dynamic<TipTapScriptEditorProps>(() => import('./TipTapScriptEditor'), { ssr: false });

interface Script {
    id: string;
    scriptNumber: number;
    title: string;
    reelLink: string | null;
    content: string | null;
    status: string;
    googleDocId: string | null;
}

interface LockInfo {
    userId: string;
    userName: string;
}

const STATUS_OPTIONS = [
    { value: 'draft', label: 'Draft', color: '#8b8b8b' },
    { value: 'shoot_pending', label: 'Shoot Pending', color: '#e8a000' },
    { value: 'shoot_done', label: 'Shoot Done', color: '#0070f3' },
    { value: 'editing', label: 'Editing', color: '#7c3aed' },
    { value: 'approved', label: 'Approved', color: '#16a34a' },
    { value: 'posted', label: 'Posted', color: '#059669' },
];

function statusColor(status: string) {
    return STATUS_OPTIONS.find(s => s.value === status)?.color || '#8b8b8b';
}

function statusLabel(status: string) {
    return STATUS_OPTIONS.find(s => s.value === status)?.label || status;
}

/** Collab socket hook for block locks on a specific page */
function useBlockLocks(pageId: string, userId: string, userName: string) {
    const socketRef = useRef<ReturnType<typeof io> | null>(null);
    const [blockLocks, setBlockLocks] = useState<Record<string, LockInfo>>({});

    useEffect(() => {
        const socket = io('http://localhost:3001');
        socketRef.current = socket;

        socket.emit('join-doc', {
            docName: `script-page:${pageId}`,
            userName,
            userColor: '#2383e2',
            userId,
        });

        socket.on('block-locks-update', (locks: Record<string, LockInfo>) => {
            setBlockLocks(locks);
        });

        return () => {
            socket.disconnect();
        };
    }, [pageId, userId, userName]);

    const lockBlock = useCallback((blockId: string) => {
        socketRef.current?.emit('block-lock', { blockId });
    }, []);

    const unlockBlock = useCallback((blockId: string) => {
        socketRef.current?.emit('block-unlock', { blockId });
    }, []);

    return { blockLocks, lockBlock, unlockBlock };
}

export default function ScriptPageView({ pageId, clientName }: { pageId: string; clientName?: string }) {
    const { data: session } = useSession();
    const userId = (session?.user as { id?: string })?.id || 'anon';
    const userName = session?.user?.name || 'Anonymous';

    const [scripts, setScripts] = useState<Script[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [fullscreen, setFullscreen] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [syncMsg, setSyncMsg] = useState('');
    const saveTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);

    const { blockLocks, lockBlock, unlockBlock } = useBlockLocks(pageId, userId, userName);

    // Fetch scripts
    const fetchScripts = useCallback(async () => {
        const res = await fetch(`/api/pages/${pageId}/scripts`);
        if (res.ok) setScripts(await res.json());
    }, [pageId]);

    useEffect(() => { fetchScripts(); }, [fetchScripts]);

    const handleAdd = async () => {
        const res = await fetch(`/api/pages/${pageId}/scripts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });
        if (res.ok) {
            const script = await res.json();
            setScripts(prev => [...prev, script]);
            setActiveId(script.id);
        }
    };

    const handleDelete = async (scriptId: string) => {
        setScripts(prev => prev.filter(s => s.id !== scriptId));
        if (activeId === scriptId) { setActiveId(null); unlockBlock(scriptId); }
        await fetch(`/api/pages/${pageId}/scripts/${scriptId}`, { method: 'DELETE' });
    };

    // Debounced save for title/reelLink/status fields
    const updateScript = useCallback(async (scriptId: string, updates: Partial<Script>) => {
        setScripts(prev => prev.map(s => s.id === scriptId ? { ...s, ...updates } : s));
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(async () => {
            await fetch(`/api/pages/${pageId}/scripts/${scriptId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
        }, 400);
    }, [pageId]);

    // Save TipTap content (debounced, 800ms)
    const handleContentChange = useCallback((scriptId: string, content: string) => {
        setScripts(prev => prev.map(s => s.id === scriptId ? { ...s, content } : s));
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(async () => {
            await fetch(`/api/pages/${pageId}/scripts/${scriptId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content }),
            });
        }, 800);
    }, [pageId]);

    const handleSyncDoc = async () => {
        setSyncing(true);
        setSyncMsg('');
        const res = await fetch(`/api/clients/${pageId}/sync-doc`, { method: 'POST' });
        const data = await res.json();
        setSyncMsg(data.message || 'Sync triggered');
        setSyncing(false);
        setTimeout(() => setSyncMsg(''), 4000);
    };

    const activeScript = scripts.find(s => s.id === activeId);

    return (
        <div className={`${styles.container} ${fullscreen ? styles.fullscreen : ''}`}>
            {/* Left panel: Script list */}
            <div className={styles.panel}>
                <div className={styles.panelHeader}>
                    <div className={styles.panelTitle}>
                        📝 {clientName ? `${clientName} Scripts` : 'Scripts'}
                        <span className={styles.count}>{scripts.length}</span>
                    </div>
                    <div className={styles.panelActions}>
                        <button
                            className={styles.iconBtn}
                            onClick={handleSyncDoc}
                            title="Sync to Google Docs (Coming Soon)"
                            disabled={syncing}
                        >
                            <RefreshCw size={14} className={syncing ? styles.spinning : ''} />
                        </button>
                        <button className={styles.addBtn} onClick={handleAdd}>
                            <Plus size={13} /> Add
                        </button>
                    </div>
                </div>
                {syncMsg && <div className={styles.syncMsg}>{syncMsg}</div>}

                {scripts.length === 0 ? (
                    <div className={styles.empty}>
                        No scripts yet. Click <strong>Add</strong> to create one.
                    </div>
                ) : (
                    <ul className={styles.scriptList}>
                        {scripts.map(script => {
                            const isLocked = blockLocks[script.id] && blockLocks[script.id].userId !== userId;
                            return (
                                <li
                                    key={script.id}
                                    className={`${styles.scriptItem} ${activeId === script.id ? styles.active : ''} ${isLocked ? styles.locked : ''}`}
                                    onClick={() => {
                                        if (activeId !== script.id) {
                                            if (activeId) unlockBlock(activeId);
                                            setActiveId(script.id);
                                            lockBlock(script.id);
                                        }
                                    }}
                                >
                                    <div className={styles.scriptNum}>{script.scriptNumber}</div>
                                    <div className={styles.scriptInfo}>
                                        <div className={styles.scriptTitle}>
                                            {script.title || `Script ${script.scriptNumber}`}
                                        </div>
                                        <div className={styles.scriptMeta}>
                                            <span
                                                className={styles.statusChip}
                                                style={{ background: statusColor(script.status) + '22', color: statusColor(script.status) }}
                                            >
                                                {statusLabel(script.status)}
                                            </span>
                                            {isLocked && (
                                                <span className={styles.lockChip}>
                                                    <Lock size={10} /> {blockLocks[script.id].userName}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        className={styles.deleteBtn}
                                        onClick={e => { e.stopPropagation(); handleDelete(script.id); }}
                                        title="Delete"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            {/* Right panel: Script editor */}
            <div className={styles.editor}>
                {!activeScript ? (
                    <div className={styles.editorEmpty}>
                        <span style={{ fontSize: 36 }}>📝</span>
                        <p>Select a script to start editing</p>
                    </div>
                ) : (
                    <>
                        {/* Editor header */}
                        <div className={styles.editorHeader}>
                            <div className={styles.editorMeta}>
                                <span className={styles.editorNum}>Script #{activeScript.scriptNumber}</span>
                                <input
                                    className={styles.editorTitle}
                                    value={activeScript.title}
                                    onChange={e => updateScript(activeScript.id, { title: e.target.value })}
                                    placeholder="Script title..."
                                />
                            </div>
                            <div className={styles.editorControls}>
                                {/* Status selector */}
                                <select
                                    className={styles.statusSelect}
                                    value={activeScript.status}
                                    onChange={e => updateScript(activeScript.id, { status: e.target.value })}
                                    style={{ color: statusColor(activeScript.status) }}
                                >
                                    {STATUS_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>

                                {/* Reel link */}
                                <input
                                    className={styles.reelInput}
                                    value={activeScript.reelLink || ''}
                                    onChange={e => updateScript(activeScript.id, { reelLink: e.target.value || null })}
                                    placeholder="Reel link..."
                                />
                                {activeScript.reelLink && (
                                    <a href={activeScript.reelLink} target="_blank" rel="noopener noreferrer" className={styles.reelLink}>
                                        <ExternalLink size={14} />
                                    </a>
                                )}

                                {/* Fullscreen toggle */}
                                <button className={styles.iconBtn} onClick={() => setFullscreen(f => !f)}>
                                    {fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                                </button>

                                {/* Close */}
                                <button className={styles.iconBtn} onClick={() => { unlockBlock(activeScript.id); setActiveId(null); }}>
                                    <X size={15} />
                                </button>
                            </div>
                        </div>

                        {/* Block-lock warning */}
                        {blockLocks[activeScript.id] && blockLocks[activeScript.id].userId !== userId && (
                            <div className={styles.lockWarning}>
                                <Lock size={13} />
                                <strong>{blockLocks[activeScript.id].userName}</strong> is currently editing this script
                            </div>
                        )}

                        {/* TipTap editor */}
                        <div className={styles.tiptapWrap}>
                            <TipTapScriptEditor
                                scriptId={activeScript.id}
                                initialContent={activeScript.content}
                                onChange={(content) => handleContentChange(activeScript.id, content)}
                                readOnly={!!(blockLocks[activeScript.id] && blockLocks[activeScript.id].userId !== userId)}
                            />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
