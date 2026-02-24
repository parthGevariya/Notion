'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2, X, ExternalLink } from 'lucide-react';
import './scripts.css';

interface Script {
    id: string;
    scriptNumber: number;
    title: string;
    reelLink: string | null;
    content: string | null;
    status: string;
    assigneeId: string | null;
}

const STATUS_OPTIONS = [
    { value: 'draft', label: 'Draft' },
    { value: 'shoot_pending', label: 'Shoot Pending' },
    { value: 'shoot_done', label: 'Shoot Done' },
    { value: 'editing', label: 'Editing' },
    { value: 'approved', label: 'Approved' },
    { value: 'posted', label: 'Posted' },
];

function statusLabel(status: string) {
    return STATUS_OPTIONS.find(s => s.value === status)?.label || status;
}

export default function ScriptPanel({ pageId }: { pageId: string }) {
    const [scripts, setScripts] = useState<Script[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const saveTimer = useRef<NodeJS.Timeout>(undefined);

    // Fetch scripts
    const fetchScripts = useCallback(async () => {
        try {
            const res = await fetch(`/api/pages/${pageId}/scripts`);
            if (res.ok) setScripts(await res.json());
        } catch (e) {
            console.error('Failed to load scripts', e);
        }
    }, [pageId]);

    useEffect(() => { fetchScripts(); }, [fetchScripts]);

    // Create new script
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

    // Update script (debounced for text fields)
    const updateScript = useCallback(async (scriptId: string, updates: Partial<Script>) => {
        setScripts(prev => prev.map(s => s.id === scriptId ? { ...s, ...updates } : s));
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(async () => {
            await fetch(`/api/pages/${pageId}/scripts/${scriptId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
        }, 400);
    }, [pageId]);

    // Update status immediately
    const updateStatus = useCallback(async (scriptId: string, status: string) => {
        setScripts(prev => prev.map(s => s.id === scriptId ? { ...s, status } : s));
        await fetch(`/api/pages/${pageId}/scripts/${scriptId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
        });
    }, [pageId]);

    // Delete script
    const handleDelete = async (scriptId: string) => {
        setScripts(prev => prev.filter(s => s.id !== scriptId));
        if (activeId === scriptId) setActiveId(null);
        await fetch(`/api/pages/${pageId}/scripts/${scriptId}`, { method: 'DELETE' });
    };

    const activeScript = scripts.find(s => s.id === activeId);

    return (
        <div className="script-panel">
            {/* Header */}
            <div className="script-panel-header">
                <div className="script-panel-title">
                    📝 Scripts
                    <span className="script-panel-count">{scripts.length}</span>
                </div>
                <button className="script-add-btn" onClick={handleAdd}>
                    <Plus size={14} /> Add Script
                </button>
            </div>

            {/* Script list */}
            {scripts.length === 0 ? (
                <div className="script-empty">
                    No scripts yet. Click &quot;Add Script&quot; to create one.
                </div>
            ) : (
                <ul className="script-list">
                    {scripts.map(script => (
                        <li
                            key={script.id}
                            className={`script-item ${activeId === script.id ? 'active' : ''}`}
                            onClick={() => setActiveId(activeId === script.id ? null : script.id)}
                        >
                            <div className="script-number">{script.scriptNumber}</div>
                            <div className="script-info">
                                <div className="script-item-title">
                                    {script.title || `Script ${script.scriptNumber}`}
                                </div>
                                <div className="script-item-meta">
                                    <span className={`script-status script-status-${script.status}`}>
                                        {statusLabel(script.status)}
                                    </span>
                                    {script.reelLink && (
                                        <a
                                            href={script.reelLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={e => e.stopPropagation()}
                                            style={{ color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: 2 }}
                                        >
                                            <ExternalLink size={12} /> Reel
                                        </a>
                                    )}
                                </div>
                            </div>
                            <div className="script-actions">
                                <button
                                    className="script-action-btn"
                                    onClick={e => { e.stopPropagation(); handleDelete(script.id); }}
                                    title="Delete script"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            {/* Inline editor for active script */}
            {activeScript && (
                <div className="script-editor">
                    <div className="script-editor-header">
                        <span className="script-editor-number">Script #{activeScript.scriptNumber}</span>
                        <button className="script-editor-close" onClick={() => setActiveId(null)}>
                            <X size={16} />
                        </button>
                    </div>

                    <div className="script-field">
                        <div className="script-field-label">Title</div>
                        <input
                            className="script-field-input"
                            value={activeScript.title}
                            onChange={e => updateScript(activeScript.id, { title: e.target.value })}
                            placeholder="Script title..."
                        />
                    </div>

                    <div className="script-field">
                        <div className="script-field-label">Instagram Reel Link</div>
                        <input
                            className="script-field-input"
                            value={activeScript.reelLink || ''}
                            onChange={e => updateScript(activeScript.id, { reelLink: e.target.value || null })}
                            placeholder="https://www.instagram.com/reel/..."
                        />
                    </div>

                    <div className="script-field">
                        <div className="script-field-label">Status</div>
                        <select
                            className="script-status-select"
                            value={activeScript.status}
                            onChange={e => updateStatus(activeScript.id, e.target.value)}
                        >
                            {STATUS_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="script-field">
                        <div className="script-field-label">Script Content</div>
                        <textarea
                            className="script-field-textarea"
                            value={activeScript.content || ''}
                            onChange={e => updateScript(activeScript.id, { content: e.target.value })}
                            placeholder="Write your script here..."
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
