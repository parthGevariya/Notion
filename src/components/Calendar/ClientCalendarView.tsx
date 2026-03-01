'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Video, CheckCircle2, Clock, Upload, ExternalLink, PlaySquare, Settings2, Instagram } from 'lucide-react';
import { useSession } from 'next-auth/react';
import PopupPreview from './PopupPreview';
import styles from './ClientCalendarView.module.css';

interface User {
    id: string;
    name: string;
    avatar: string | null;
}

interface Script {
    id: string;
    scriptNumber: number;
    title: string;
    content: string | null;
}

interface CalendarRow {
    id: string;
    date: Date | null;
    title: string;
    scriptId: string | null;
    caption: string | null;
    thumbnail: string | null;
    status: string; // idea, scripted, shooting, editing, ready, posted
    assigneeId: string | null;
    driveLink: string | null;
    socialMedia: string | null;
    position: number;
    script?: Script | null;
    assignee?: User | null;
}

interface PageData {
    id: string;
    title: string;
    clientId: string | null;
    client?: { id: string; name: string; settings: string | null } | null;
}

const DEFAULT_COLS = {
    date: true,
    title: true,
    script: true,
    status: true,
    assignee: true,
    media: true,
    caption: true,
    socials: true,
};

const STATUS_OPTIONS = [
    { value: 'idea', label: 'Idea', color: 'var(--text-tertiary)', bg: 'var(--bg-hover)' },
    { value: 'scripted', label: 'Scripted', color: '#d97706', bg: '#fef3c7' }, // Amber
    { value: 'shooting', label: 'Shooting', color: '#2563eb', bg: '#dbeafe' }, // Blue
    { value: 'editing', label: 'Editing', color: '#9333ea', bg: '#f3e8ff' }, // Purple
    { value: 'ready', label: 'Ready', color: '#16a34a', bg: '#dcfce7' }, // Green
    { value: 'posted', label: 'Posted', color: '#4b5563', bg: '#f3f4f6' }, // Gray
];

export default function ClientCalendarView({ pageId }: { pageId: string }) {
    const { data: session } = useSession();
    const role = (session?.user as { role?: string })?.role || 'viewer';

    const [page, setPage] = useState<PageData | null>(null);
    const [rows, setRows] = useState<CalendarRow[]>([]);
    const [scripts, setScripts] = useState<Script[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>(DEFAULT_COLS);
    const [showColMenu, setShowColMenu] = useState(false);

    // Track which cell is currently focused for inline editing
    const [editingCell, setEditingCell] = useState<{ rowId: string, field: string } | null>(null);

    // Popup state
    const [popupContent, setPopupContent] = useState<{ type: 'script' | 'caption' | 'thumbnail', content: any } | null>(null);

    useEffect(() => {
        fetchData();
    }, [pageId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch page to get clientId
            const pageRes = await fetch(`/api/pages/${pageId}`);
            if (!pageRes.ok) return;
            const pageData = await pageRes.json();
            setPage(pageData);

            if (!pageData.clientId) return;

            // Load saved settings
            if (pageData.client?.settings) {
                try {
                    const parsed = JSON.parse(pageData.client.settings);
                    if (parsed.columnVisibility) {
                        setVisibleCols({ ...DEFAULT_COLS, ...parsed.columnVisibility });
                    }
                } catch (e) { console.error('Failed to parse client settings', e); }
            }

            // 2. Fetch rows
            const rowsRes = await fetch(`/api/clients/${pageData.clientId}/calendar`);
            if (rowsRes.ok) {
                const rowsData = await rowsRes.json();
                setRows(rowsData);
            }

            // 3. Fetch available scripts for this client
            // The scripts live under the client's Script page. We'll fetch all pages for the client, find the script page, and get its scripts
            const clientPagesRes = await fetch(`/api/pages?clientId=${pageData.clientId}`);
            if (clientPagesRes.ok) {
                const clientPages = await clientPagesRes.json();
                const scriptPage = clientPages.find((p: any) => p.pageType === 'script_page');
                if (scriptPage) {
                    const scriptsRes = await fetch(`/api/pages/${scriptPage.id}/scripts`);
                    if (scriptsRes.ok) {
                        setScripts(await scriptsRes.json());
                    }
                }
            }

            // 4. Fetch workspace users (for assignees)
            const usersRes = await fetch('/api/users');
            if (usersRes.ok) {
                setUsers(await usersRes.json());
            }

        } catch (e) {
            console.error('Error fetching calendar data', e);
        } finally {
            setLoading(false);
        }
    };

    const handleAddRow = async () => {
        if (!page?.clientId) return;
        try {
            const res = await fetch(`/api/clients/${page.clientId}/calendar`, {
                method: 'POST'
            });
            if (res.ok) {
                const newRow = await res.json();
                setRows(prev => [...prev, newRow]);
            }
        } catch (e) {
            console.error('Failed to add row', e);
        }
    };

    const handleDeleteRow = async (rowId: string) => {
        if (!page?.clientId) return;
        setRows(prev => prev.filter(r => r.id !== rowId)); // Optimistic UI
        try {
            await fetch(`/api/clients/${page.clientId}/calendar/${rowId}`, {
                method: 'DELETE'
            });
        } catch (e) {
            console.error('Failed to delete row', e);
            fetchData(); // Revert on failure
        }
    };

    const updateRow = async (rowId: string, field: keyof CalendarRow, value: any) => {
        if (!page?.clientId) return;

        // Optimistic UI
        setRows(prev => prev.map(r => r.id === rowId ? { ...r, [field]: value } : r));

        try {
            await fetch(`/api/clients/${page.clientId}/calendar/${rowId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [field]: value })
            });
        } catch (e) {
            console.error('Failed to update row', e);
        }
    };

    const handleFileUpload = async (rowId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        if (!page?.clientId || !e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];

        // Show optimistic loading state in UI
        setRows(prev => prev.map(r => r.id === rowId ? { ...r, driveLink: 'uploading...' } : r));

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch(`/api/clients/${page.clientId}/calendar/${rowId}/upload-video`, {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                const data = await res.json();
                setRows(prev => prev.map(r => r.id === rowId ? { ...r, driveLink: data.driveLink } : r));
            } else {
                fetchData(); // Revert on failure
            }
        } catch (err) {
            console.error('Upload failed', err);
            fetchData(); // Revert on failure
        }
    };

    const toggleColumn = async (colKey: string) => {
        if (!page?.clientId) return;
        const newCols = { ...visibleCols, [colKey]: !visibleCols[colKey] };
        setVisibleCols(newCols);

        // Save to Client settings JSON
        try {
            const currentSettings = page.client?.settings ? JSON.parse(page.client.settings) : {};
            currentSettings.columnVisibility = newCols;

            await fetch(`/api/clients/${page.clientId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings: JSON.stringify(currentSettings) })
            });

            // Update local page client obj so subsequent saves don't overwrite
            setPage(prev => prev ? { ...prev, client: { ...prev.client!, settings: JSON.stringify(currentSettings) } } : null);
        } catch (err) {
            console.error('Failed to save settings', err);
        }
    };

    if (loading) return <div className={styles.loading}>Loading Calendar...</div>;

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <h1>{page?.title || 'Content Calendar'}</h1>
                    {page?.client && <div className={styles.clientBadge}>{page.client.name}</div>}
                </div>

                {(role === 'manager' || role === 'owner') && (
                    <div style={{ position: 'relative', marginLeft: 'auto' }}>
                        <button
                            className={styles.colToggleBtn}
                            onClick={() => setShowColMenu(!showColMenu)}
                        >
                            <Settings2 size={16} /> Columns
                        </button>

                        {showColMenu && (
                            <div className={styles.colMenu}>
                                <div className={styles.colMenuHeader}>Visible Columns</div>
                                {Object.keys(DEFAULT_COLS).map(col => (
                                    <label key={col} className={styles.colMenuItem}>
                                        <input
                                            type="checkbox"
                                            checked={!!visibleCols[col]}
                                            onChange={() => toggleColumn(col)}
                                        />
                                        {col.charAt(0).toUpperCase() + col.slice(1)}
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className={styles.tableWrapper}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th style={{ width: '40px' }}></th>
                            {visibleCols.date && <th style={{ width: '150px' }}>Date</th>}
                            {visibleCols.title && <th style={{ width: '250px' }}>Idea / Title</th>}
                            {visibleCols.script && <th style={{ width: '200px' }}>Script</th>}
                            {visibleCols.status && <th style={{ width: '120px' }}>Status</th>}
                            {visibleCols.assignee && <th style={{ width: '150px' }}>Assignee</th>}
                            {visibleCols.media && <th style={{ width: '150px' }}>Video / Media</th>}
                            {visibleCols.caption && <th style={{ width: '150px' }}>Caption</th>}
                            {visibleCols.socials && <th style={{ width: '100px' }}>Socials</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(row => {
                            const currentStatus = STATUS_OPTIONS.find(s => s.value === row.status) || STATUS_OPTIONS[0];

                            return (
                                <tr key={row.id}>
                                    <td className={styles.actionCell}>
                                        <button onClick={() => handleDeleteRow(row.id)} className={styles.deleteBtn}>
                                            <Trash2 size={14} />
                                        </button>
                                    </td>

                                    {/* Date */}
                                    {visibleCols.date && (
                                        <td className={styles.cell}>
                                            <input
                                                type="date"
                                                value={row.date ? new Date(row.date).toISOString().split('T')[0] : ''}
                                                onChange={(e) => updateRow(row.id, 'date', e.target.value)}
                                                className={styles.dateInput}
                                            />
                                        </td>
                                    )}

                                    {/* Title */}
                                    {visibleCols.title && (
                                        <td className={styles.cell}>
                                            <input
                                                type="text"
                                                value={row.title}
                                                onChange={(e) => updateRow(row.id, 'title', e.target.value)}
                                                placeholder="Empty idea..."
                                                className={styles.titleInput}
                                            />
                                        </td>
                                    )}

                                    {/* Script */}
                                    {visibleCols.script && (
                                        <td className={styles.cell}>
                                            <div className={styles.scriptCell}>
                                                <select
                                                    value={row.scriptId || ''}
                                                    onChange={(e) => updateRow(row.id, 'scriptId', e.target.value || null)}
                                                    className={styles.select}
                                                >
                                                    <option value="">No script</option>
                                                    {scripts.map(s => (
                                                        <option key={s.id} value={s.id}>#{s.scriptNumber}: {s.title || 'Untitled'}</option>
                                                    ))}
                                                </select>
                                                {row.scriptId && (
                                                    <button
                                                        className={styles.expandBtn}
                                                        onClick={() => setPopupContent({ type: 'script', content: scripts.find(s => s.id === row.scriptId) })}
                                                    >
                                                        <ExternalLink size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    )}

                                    {/* Status */}
                                    {visibleCols.status && (
                                        <td className={styles.cell}>
                                            <select
                                                value={row.status}
                                                onChange={(e) => updateRow(row.id, 'status', e.target.value)}
                                                style={{
                                                    color: currentStatus.color,
                                                    backgroundColor: currentStatus.bg,
                                                    fontWeight: 600
                                                }}
                                                className={styles.statusSelect}
                                            >
                                                {STATUS_OPTIONS.map(opt => (
                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                ))}
                                            </select>
                                        </td>
                                    )}

                                    {/* Assignee */}
                                    {visibleCols.assignee && (
                                        <td className={styles.cell}>
                                            <select
                                                value={row.assigneeId || ''}
                                                onChange={(e) => updateRow(row.id, 'assigneeId', e.target.value || null)}
                                                className={styles.select}
                                            >
                                                <option value="">Unassigned</option>
                                                {users.map(u => (
                                                    <option key={u.id} value={u.id}>{u.name}</option>
                                                ))}
                                            </select>
                                        </td>
                                    )}

                                    {/* Media / Video Upload */}
                                    {visibleCols.media && (
                                        <td className={styles.cell}>
                                            {row.driveLink === 'uploading...' ? (
                                                <span className={styles.uploadingText}>Uploading...</span>
                                            ) : row.driveLink ? (
                                                <a href={row.driveLink} target="_blank" rel="noopener noreferrer" className={styles.driveLinkBtn}>
                                                    <PlaySquare size={14} /> View File
                                                </a>
                                            ) : (
                                                <label className={styles.uploadBtn}>
                                                    <Upload size={14} /> Upload Video
                                                    <input
                                                        type="file"
                                                        style={{ display: 'none' }}
                                                        onChange={(e) => handleFileUpload(row.id, e)}
                                                    />
                                                </label>
                                            )}
                                        </td>
                                    )}

                                    {/* Caption */}
                                    {visibleCols.caption && (
                                        <td className={styles.cell}>
                                            <div className={styles.scriptCell}>
                                                <input
                                                    type="text"
                                                    value={row.caption || ''}
                                                    onChange={(e) => updateRow(row.id, 'caption', e.target.value)}
                                                    placeholder="..."
                                                    className={styles.titleInput}
                                                />
                                                {row.caption && (
                                                    <button
                                                        className={styles.expandBtn}
                                                        onClick={() => setPopupContent({ type: 'caption', content: row.caption })}
                                                    >
                                                        <ExternalLink size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    )}

                                    {/* Socials Placeholder */}
                                    {visibleCols.socials && (
                                        <td className={styles.cell} style={{ textAlign: 'center' }}>
                                            <div className={styles.tooltipContainer}>
                                                <button
                                                    className={styles.socialBtnDisabled}
                                                    disabled
                                                >
                                                    <Instagram size={14} />
                                                </button>
                                                <div className={styles.tooltipText}>Coming in v2</div>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                <button className={styles.addRowBtn} onClick={handleAddRow}>
                    <Plus size={16} /> New Row
                </button>
            </div>

            {popupContent && (
                <PopupPreview
                    type={popupContent.type}
                    content={popupContent.content}
                    onClose={() => setPopupContent(null)}
                />
            )}
        </div>
    );
}
