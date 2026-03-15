'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Upload, ExternalLink, PlaySquare, Settings2, Instagram, ImageIcon, Copy, Check, X } from 'lucide-react';
import { useSession } from 'next-auth/react';
import styles from './ClientCalendarView.module.css';
import { useAppSocket } from '@/lib/useAppSocket';

interface User {
    id: string;
    name: string;
    avatar: string | null;
}

interface ScriptSection {
    id: string;
    title: string;
    previewText: string;
}

interface CustomColumn {
    id: string;
    name: string;
}

interface CalendarRow {
    id: string;
    date: Date | null;
    postDate: Date | null;
    shootDate: Date | null;
    title: string;
    scriptDetails: string | null;
    caption: string | null;
    thumbnail: string | null;
    shootStatus: string;
    shootPersonId: string | null;
    editStatus: string;
    editorId: string | null;
    approvalStatus: string | null;
    approvalMsg: string | null;
    driveLink: string | null;
    socialMedia: string | null;
    position: number;
    keywords?: string | null;
    link?: string | null;
    customCols?: string | null;
    shootPerson?: User | null;
    editor?: User | null;
}

interface PageData {
    id: string;
    title: string;
    clientId: string | null;
    workspaceId: string;
    client?: { id: string; name: string; settings: string | null } | null;
}

const DEFAULT_COLS = {
    sr: true,
    postDate: true,
    shootDate: true,
    topic: true,
    script: true,
    shoot: true,
    person: true,
    edit: true,
    editor: true,
    caption: true,
    keywords: true,
    link: true,
    video: true,
    thumbnail: true,
    approved: true,
    socials: true,
};

const SHOOT_EDIT_STATUS = [
    { value: 'pending', label: 'Pending', color: 'var(--text-tertiary)', bg: 'var(--bg-hover)' },
    { value: 'happening', label: 'Happening', color: '#2563eb', bg: '#dbeafe' },
    { value: 'done', label: 'Done', color: '#16a34a', bg: '#dcfce7' },
];

const APPROVAL_STATUS = [
    { value: '', label: 'Not Sent', color: 'var(--text-tertiary)', bg: 'transparent' },
    { value: 'Approved', label: 'Approved', color: '#16a34a', bg: '#dcfce7' },
    { value: 'Changes', label: 'Changes', color: '#ef4444', bg: '#fee2e2' },
];

function parseScriptsFromDoc(doc: any): ScriptSection[] {
    if (!doc || !doc.content || !Array.isArray(doc.content)) return [];
    
    const sections: any[] = [];
    let currentSection: any = null;
    
    const getTextFromNode = (node: any): string => {
        if (node.text) return node.text;
        if (node.content && Array.isArray(node.content)) {
            return node.content.map(getTextFromNode).join('');
        }
        if (node.type === 'paragraph') return '\n';
        return '';
    };

    for (const node of doc.content) {
        if (node.type === 'heading' && node.attrs?.level === 1) {
            const text = getTextFromNode(node).trim();
            currentSection = { id: text, title: text || 'Untitled', contentBlocks: [] };
            sections.push(currentSection);
        } else if (currentSection) {
            currentSection.contentBlocks.push(node);
        }
    }
    
    return sections.map((sec, idx) => {
        const previewText = sec.contentBlocks.map(getTextFromNode).filter(Boolean).join('\n').trim().substring(0, 500);
        return {
           id: sec.id || `Untitled-${idx}`,
           title: sec.title || `Untitled-${idx}`,
           previewText: previewText || 'No content'
        };
    });
}

export default function ClientCalendarView({ pageId }: { pageId: string }) {
    const { data: session } = useSession();
    const role = (session?.user as { role?: string })?.role || 'viewer';

    const [page, setPage] = useState<PageData | null>(null);
    const [rows, setRows] = useState<CalendarRow[]>([]);
    const [scriptSections, setScriptSections] = useState<ScriptSection[]>([]);
    const [scriptPageId, setScriptPageId] = useState<string | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>(DEFAULT_COLS);
    const [showColMenu, setShowColMenu] = useState(false);
    const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);
    const [newColName, setNewColName] = useState('');
    
    // Upload state
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
    const [activeUploads, setActiveUploads] = useState<Record<string, XMLHttpRequest>>({});
    const [copiedLink, setCopiedLink] = useState<string | null>(null);

    const colMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (colMenuRef.current && !colMenuRef.current.contains(event.target as Node)) {
                setShowColMenu(false);
            }
        }
        
        if (showColMenu) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [showColMenu]);

    useEffect(() => {
        fetchData();
    }, [pageId]);

    // ── Real-time calendar updates ──────────────────────────────────────────
    const socket = useAppSocket();

    useEffect(() => {
        if (!socket || !page?.clientId) return;
        const myClientId = page.clientId;

        const onRowCreated = (payload: { clientId: string; row: CalendarRow }) => {
            if (payload.clientId !== myClientId) return;
            setRows(prev => {
                if (prev.some(r => r.id === payload.row.id)) return prev;
                return [...prev, payload.row];
            });
        };

        const onRowUpdated = (payload: { clientId: string; row: CalendarRow }) => {
            if (payload.clientId !== myClientId) return;
            setRows(prev => prev.map(r => r.id === payload.row.id ? payload.row : r));
        };

        const onRowDeleted = (payload: { clientId: string; rowId: string }) => {
            if (payload.clientId !== myClientId) return;
            setRows(prev => prev.filter(r => r.id !== payload.rowId));
        };

        socket.on('calendar-row-created', onRowCreated);
        socket.on('calendar-row-updated', onRowUpdated);
        socket.on('calendar-row-deleted', onRowDeleted);

        return () => {
            socket.off('calendar-row-created', onRowCreated);
            socket.off('calendar-row-updated', onRowUpdated);
            socket.off('calendar-row-deleted', onRowDeleted);
        };
    }, [socket, page?.clientId]);
    // ── End real-time ────────────────────────────────────────────────────────────
    const fetchData = async () => {
        setLoading(true);
        try {
            const pageRes = await fetch(`/api/pages/${pageId}`);
            if (!pageRes.ok) return;
            const pageData = await pageRes.json();
            setPage(pageData);

            if (!pageData.clientId) return;

            if (pageData.client?.settings) {
                try {
                    const parsed = JSON.parse(pageData.client.settings);
                    if (parsed.columnVisibility) {
                        setVisibleCols({ ...DEFAULT_COLS, ...parsed.columnVisibility });
                    }
                    if (parsed.customColumns) {
                        setCustomColumns(parsed.customColumns);
                    }
                } catch (e) { console.error('Failed to parse client settings', e); }
            }

            const rowsRes = await fetch(`/api/clients/${pageData.clientId}/calendar`);
            if (rowsRes.ok) {
                setRows(await rowsRes.json());
            }

            const clientPagesRes = await fetch(`/api/pages?clientId=${pageData.clientId}`);
            console.log('clientPagesRes status:', clientPagesRes.status);
            if (clientPagesRes.ok) {
                const clientPages = await clientPagesRes.json();
                console.log('clientPages data:', clientPages);
                const scriptPage = clientPages.find((p: any) => p.pageType === 'script_page');
                if (scriptPage) {
                    setScriptPageId(scriptPage.id);
                    const scriptsRes = await fetch(`/api/pages/${scriptPage.id}/scripts`);
                    console.log('scriptsRes status:', scriptsRes.status);
                    if (scriptsRes.ok) {
                        const scripts = await scriptsRes.json();
                        console.log('scripts data:', scripts);
                        let allSections: ScriptSection[] = [];
                        for (const script of scripts) {
                            if (script.content) {
                                try {
                                    const doc = JSON.parse(script.content);
                                    const sections = parseScriptsFromDoc(doc);
                                    console.log(`Parsed ${sections.length} headers for script ${script.scriptNumber}`);
                                    const prefixedSections = sections.map(sec => ({
                                        ...sec,
                                        title: `[Script ${script.scriptNumber}] ${sec.title}`
                                    }));
                                    allSections = [...allSections, ...prefixedSections];
                                } catch (e) {
                                    console.error('Failed to parse tip tap doc for script', script.id);
                                }
                            }
                        }
                        setScriptSections(allSections);
                    }
                } else {
                    console.warn('No script_page found for client', pageData.clientId);
                }
            }

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
            } else {
                const err = await res.text();
                alert('Add Row failed: ' + err);
            }
        } catch (e) {
            console.error('Failed to add row', e);
        }
    };

    const handleDeleteRow = async (rowId: string) => {
        if (!page?.clientId) return;
        setRows(prev => prev.filter(r => r.id !== rowId));
        try {
            await fetch(`/api/clients/${page.clientId}/calendar/${rowId}`, {
                method: 'DELETE'
            });
        } catch (e) {
            console.error('Failed to delete row', e);
            fetchData();
        }
    };

    const updateRow = async (rowId: string, field: keyof CalendarRow, value: any) => {
        if (!page?.clientId) return;
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

    const updateCustomCol = async (rowId: string, colId: string, value: string) => {
        const row = rows.find(r => r.id === rowId);
        if (!row || !page?.clientId) return;
        
        let colsData: Record<string, string> = {};
        try { colsData = row.customCols ? JSON.parse(row.customCols) : {}; } catch(e){}
        colsData[colId] = value;
        const newCustomColsStr = JSON.stringify(colsData);
        
        setRows(prev => prev.map(r => r.id === rowId ? { ...r, customCols: newCustomColsStr } : r));
        
        try {
            await fetch(`/api/clients/${page.clientId}/calendar/${rowId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customCols: newCustomColsStr })
            });
        } catch (e) { console.error('Failed to update custom column', e); }
    };

    const addCustomColumn = async () => {
        if (!newColName.trim() || !page?.clientId) return;
        const colId = 'col_' + Date.now();
        const newCol = { id: colId, name: newColName.trim() };
        const updatedCols = [...customColumns, newCol];
        setCustomColumns(updatedCols);
        setNewColName('');
        
        try {
            const currentSettings = page.client?.settings ? JSON.parse(page.client.settings) : {};
            currentSettings.customColumns = updatedCols;
            await fetch(`/api/clients/${page.clientId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings: JSON.stringify(currentSettings) })
            });
            setPage(prev => prev ? { ...prev, client: { ...prev.client!, settings: JSON.stringify(currentSettings) } } : null);
        } catch (err) { console.error('Failed to save settings', err); }
    };

    const removeCustomColumn = async (colId: string) => {
        if (!page?.clientId || !confirm('Remove this custom column for everyone?')) return;
        const updatedCols = customColumns.filter(c => c.id !== colId);
        setCustomColumns(updatedCols);
        
        try {
            const currentSettings = page.client?.settings ? JSON.parse(page.client.settings) : {};
            currentSettings.customColumns = updatedCols;
            await fetch(`/api/clients/${page.clientId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings: JSON.stringify(currentSettings) })
            });
            setPage(prev => prev ? { ...prev, client: { ...prev.client!, settings: JSON.stringify(currentSettings) } } : null);
        } catch (err) { console.error('Failed to save settings', err); }
    };

    const handleFillDown = (e: React.KeyboardEvent<HTMLElement>, rowIndex: number, field: string, isCustom = false) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
            e.preventDefault();
            if (rowIndex > 0) {
                const prevRow = rows[rowIndex - 1];
                if (isCustom) {
                    let prevCols: Record<string, string> = {};
                    try { prevCols = prevRow.customCols ? JSON.parse(prevRow.customCols) : {}; } catch(e){}
                    const valToCopy = prevCols[field] || '';
                    updateCustomCol(rows[rowIndex].id, field, valToCopy);
                } else {
                    let valToCopy = (prevRow as any)[field];
                    if (valToCopy === undefined) valToCopy = null;
                    updateRow(rows[rowIndex].id, field as keyof CalendarRow, valToCopy);
                }
            }
        }
    };

    const handleCopy = (link: string) => {
        navigator.clipboard.writeText(link);
        setCopiedLink(link);
        setTimeout(() => setCopiedLink(null), 2000);
    };

    const cancelUpload = (uploadKey: string) => {
        if (activeUploads[uploadKey]) {
            activeUploads[uploadKey].abort();
        }
    };

    const uploadFileWithProgress = (
        url: string,
        file: File,
        uploadKey: string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onSuccess: (data: any) => void
    ) => {
        const xhr = new XMLHttpRequest();
        setActiveUploads(prev => ({ ...prev, [uploadKey]: xhr }));
        setUploadProgress(prev => ({ ...prev, [uploadKey]: 0 }));

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const percentComplete = Math.round((e.loaded / e.total) * 100);
                setUploadProgress(prev => ({ ...prev, [uploadKey]: percentComplete }));
            }
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    onSuccess(data);
                } catch (err) {
                    console.error('Failed to parse response', err);
                    fetchData(); // fallback
                }
            } else {
                console.error('Upload failed with status', xhr.status);
                fetchData();
            }
            setUploadProgress(prev => { const n = {...prev}; delete n[uploadKey]; return n; });
            setActiveUploads(prev => { const n = {...prev}; delete n[uploadKey]; return n; });
        };

        xhr.onerror = () => {
            console.error('Upload failed due to network error');
            setUploadProgress(prev => { const n = {...prev}; delete n[uploadKey]; return n; });
            setActiveUploads(prev => { const n = {...prev}; delete n[uploadKey]; return n; });
            fetchData();
        };

        xhr.onabort = () => {
            console.log(`Upload ${uploadKey} aborted`);
            setUploadProgress(prev => { const n = {...prev}; delete n[uploadKey]; return n; });
            setActiveUploads(prev => { const n = {...prev}; delete n[uploadKey]; return n; });
            // Revert placeholder state
            fetchData();
        };

        xhr.open('POST', url, true);
        const formData = new FormData();
        formData.append('file', file);
        xhr.send(formData);
    };

    const deleteMedia = async (rowId: string, type: 'video' | 'thumbnail') => {
        if (!page?.clientId) return;
        if (!confirm(`Are you sure you want to delete this ${type} from Google Drive?`)) return;
        
        try {
            const res = await fetch(`/api/clients/${page.clientId}/calendar/${rowId}/delete-${type}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                if (type === 'video') {
                     setRows(prev => prev.map(r => r.id === rowId ? { ...r, driveLink: null } : r));
                } else {
                     setRows(prev => prev.map(r => r.id === rowId ? { ...r, thumbnail: null } : r));
                }
            } else {
                alert('Delete failed');
            }
        } catch (e) {
            console.error('Delete failed', e);
        }
    };

    const handleThumbnailUpload = async (rowId: string, file: File) => {
        if (!page?.clientId) return;
        setRows(prev => prev.map(r => r.id === rowId ? { ...r, thumbnail: 'uploading...' } : r));
        uploadFileWithProgress(
            `/api/clients/${page.clientId}/calendar/${rowId}/upload-thumbnail`,
            file,
            `${rowId}-thumb`,
            (data) => setRows(prev => prev.map(r => r.id === rowId ? { ...r, thumbnail: data.thumbnail } : r))
        );
    };

    const handleVideoUpload = async (rowId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        if (!page?.clientId || !e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        setRows(prev => prev.map(r => r.id === rowId ? { ...r, driveLink: 'uploading...' } : r));
        uploadFileWithProgress(
            `/api/clients/${page.clientId}/calendar/${rowId}/upload-video`,
            file,
            `${rowId}-video`,
            (data) => setRows(prev => prev.map(r => r.id === rowId ? { ...r, driveLink: data.driveLink } : r))
        );
    };

    const toggleColumn = async (colKey: string) => {
        if (!page?.clientId) return;
        const newCols = { ...visibleCols, [colKey]: !visibleCols[colKey] };
        setVisibleCols(newCols);
        try {
            const currentSettings = page.client?.settings ? JSON.parse(page.client.settings) : {};
            currentSettings.columnVisibility = newCols;
            await fetch(`/api/clients/${page.clientId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings: JSON.stringify(currentSettings) })
            });
            setPage(prev => prev ? { ...prev, client: { ...prev.client!, settings: JSON.stringify(currentSettings) } } : null);
        } catch (err) {
            console.error('Failed to save settings', err);
        }
    };

    if (loading) return <div className={styles.loading}>Loading Calendar...</div>;

    const renderUserDropdown = (row: CalendarRow, index: number, field: 'shootPersonId' | 'editorId', statusField: 'shootStatus' | 'editStatus') => {
        const status = SHOOT_EDIT_STATUS.find(s => s.value === row[statusField]) || SHOOT_EDIT_STATUS[0];
        const value = row[field] || '';
        return (
            <select
                value={value}
                onChange={(e) => updateRow(row.id, field, e.target.value || null)}
                onKeyDown={(e) => handleFillDown(e as unknown as React.KeyboardEvent<HTMLElement>, index, field)}
                className={styles.select}
                style={{ color: value ? status.color : 'var(--text-tertiary)', fontWeight: value ? 600 : 'normal' }}
            >
                <option value="">Unassigned</option>
                {users.map(u => (
                    <option key={u.id} value={u.id} style={{ color: 'var(--text-primary)' }}>{u.name}</option>
                ))}
            </select>
        );
    };

    const renderStatusDropdown = (row: CalendarRow, index: number, field: 'shootStatus' | 'editStatus') => {
        const currentStatus = SHOOT_EDIT_STATUS.find(s => s.value === row[field]) || SHOOT_EDIT_STATUS[0];
        return (
            <select
                value={row[field]}
                onChange={(e) => updateRow(row.id, field, e.target.value)}
                onKeyDown={(e) => handleFillDown(e as unknown as React.KeyboardEvent<HTMLElement>, index, field)}
                style={{ color: currentStatus.color, backgroundColor: currentStatus.bg, fontWeight: 600 }}
                className={styles.statusSelect}
            >
                {SHOOT_EDIT_STATUS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
        );
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <h1>{page?.title || 'Content Calendar'}</h1>
                    {page?.client && <div className={styles.clientBadge}>{page.client.name}</div>}
                </div>

                {(role === 'manager' || role === 'owner') && (
                    <div style={{ position: 'relative', marginLeft: 'auto' }} ref={colMenuRef}>
                        <button className={styles.colToggleBtn} onClick={() => setShowColMenu(!showColMenu)}>
                            <Settings2 size={16} /> Columns
                        </button>

                        {showColMenu && (
                            <div className={styles.colMenu}>
                                <div className={styles.colMenuHeader} style={{ marginTop: 12 }}>Custom Columns</div>
                                {customColumns.map(c => (
                                    <div key={c.id} className={styles.colMenuItem} style={{ display: 'flex', justifyContent: 'space-between', paddingRight: '8px' }}>
                                        <span>{c.name}</span>
                                        <button onClick={() => removeCustomColumn(c.id)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={12}/></button>
                                    </div>
                                ))}
                                <div style={{ display: 'flex', gap: 4, marginTop: 8, padding: '0 12px 12px 12px' }}>
                                    <input type="text" value={newColName} onChange={e => setNewColName(e.target.value)} placeholder="New Col Name" style={{ flex: 1, padding: '4px 8px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}/>
                                    <button onClick={addCustomColumn} style={{ padding: '4px 8px', fontSize: '12px', background: 'var(--text-primary)', color: 'var(--bg-primary)', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Add</button>
                                </div>
                                <div className={styles.colMenuHeader} style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>Visible Default Columns</div>
                                {Object.keys(DEFAULT_COLS).map(col => (
                                    <label key={col} className={styles.colMenuItem}>
                                        <input
                                            type="checkbox"
                                            checked={!!visibleCols[col]}
                                            onChange={() => toggleColumn(col)}
                                        />
                                        {col === 'sr' ? 'Sr. No' : col.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
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
                            {visibleCols.sr && <th style={{ width: '60px' }}>Sr. No</th>}
                            {visibleCols.postDate && <th style={{ width: '130px' }}>Post Date</th>}
                            {visibleCols.shootDate && <th style={{ width: '130px' }}>Shoot Date</th>}
                            {visibleCols.topic && <th style={{ width: '200px' }}>Topic</th>}
                            {visibleCols.script && <th style={{ width: '200px' }}>Script</th>}
                            {visibleCols.shoot && <th style={{ width: '110px' }}>Shoot</th>}
                            {visibleCols.person && <th style={{ width: '120px' }}>Person</th>}
                            {visibleCols.edit && <th style={{ width: '110px' }}>Edit</th>}
                            {visibleCols.editor && <th style={{ width: '120px' }}>Editor</th>}
                            {visibleCols.caption && <th style={{ width: '200px' }}>Caption</th>}
                            {visibleCols.video && <th style={{ width: '220px' }}>Video</th>}
                            {visibleCols.thumbnail && <th style={{ width: '220px' }}>Thumbnail</th>}
                            {visibleCols.approved && <th style={{ width: '150px' }}>Approved</th>}
                            {visibleCols.socials && <th style={{ width: '80px' }}>Socials</th>}
                            {visibleCols.keywords && <th style={{ width: '200px' }}>Keywords</th>}
                            {visibleCols.link && <th style={{ width: '200px' }}>Link</th>}
                            {customColumns.map(c => <th key={c.id} style={{ width: '200px' }}>{c.name}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, index) => {
                            const selectedScript = scriptSections.find(s => s.id === row.scriptDetails);
                            const currentApproval = APPROVAL_STATUS.find(s => s.value === (row.approvalStatus || '')) || APPROVAL_STATUS[0];

                            return (
                                <tr key={row.id}>
                                    <td className={styles.actionCell}>
                                        <button onClick={() => handleDeleteRow(row.id)} className={styles.deleteBtn}>
                                            <Trash2 size={14} />
                                        </button>
                                    </td>

                                    {visibleCols.sr && (
                                        <td className={styles.cell} style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>
                                            {index + 1}
                                        </td>
                                    )}

                                    {visibleCols.postDate && (
                                        <td className={styles.cell}>
                                            <input
                                                type="date"
                                                value={row.postDate ? new Date(row.postDate).toISOString().split('T')[0] : ''}
                                                onChange={(e) => updateRow(row.id, 'postDate', e.target.value)}
                                                onKeyDown={(e) => handleFillDown(e, index, 'postDate')}
                                                className={styles.dateInput}
                                            />
                                        </td>
                                    )}

                                    {visibleCols.shootDate && (
                                        <td className={styles.cell}>
                                            <input
                                                type="date"
                                                value={row.shootDate ? new Date(row.shootDate).toISOString().split('T')[0] : ''}
                                                onChange={(e) => updateRow(row.id, 'shootDate', e.target.value)}
                                                onKeyDown={(e) => handleFillDown(e, index, 'shootDate')}
                                                className={styles.dateInput}
                                            />
                                        </td>
                                    )}

                                    {visibleCols.topic && (
                                        <td className={styles.cell}>
                                            <input
                                                type="text"
                                                value={row.title}
                                                onChange={(e) => updateRow(row.id, 'title', e.target.value)}
                                                onKeyDown={(e) => handleFillDown(e, index, 'title')}
                                                placeholder="Enter topic..."
                                                className={styles.titleInput}
                                            />
                                        </td>
                                    )}

                                    {visibleCols.script && (
                                        <td className={styles.cell}>
                                            <div className={styles.hoverTooltipContainer}>
                                                <select
                                                    value={row.scriptDetails || ''}
                                                    onChange={(e) => updateRow(row.id, 'scriptDetails', e.target.value || null)}
                                                    onKeyDown={(e) => handleFillDown(e as unknown as React.KeyboardEvent<HTMLElement>, index, 'scriptDetails')}
                                                    className={styles.select}
                                                    style={{ textOverflow: 'ellipsis' }}
                                                >
                                                    <option value="">Select Script</option>
                                                    {scriptSections.map(s => (
                                                        <option key={s.id} value={s.id}>{s.title}</option>
                                                    ))}
                                                </select>
                                                {selectedScript && (
                                                    <div className={styles.hoverTooltipText}>
                                                        <h4>{selectedScript.title}</h4>
                                                        <p>{selectedScript.previewText}</p>
                                                        {scriptPageId && (
                                                            <a href={`/${page?.workspaceId}/${scriptPageId}#${encodeURIComponent(selectedScript.title)}`}
                                                                target="_blank" rel="noopener noreferrer"
                                                                className={styles.directLinkBtn}>
                                                                <ExternalLink size={12} /> View in Script Page
                                                            </a>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    )}

                                    {visibleCols.shoot && (
                                        <td className={styles.cell}>
                                            {renderStatusDropdown(row, index, 'shootStatus')}
                                        </td>
                                    )}

                                    {visibleCols.person && (
                                        <td className={styles.cell}>
                                            {renderUserDropdown(row, index, 'shootPersonId', 'shootStatus')}
                                        </td>
                                    )}

                                    {visibleCols.edit && (
                                        <td className={styles.cell}>
                                            {renderStatusDropdown(row, index, 'editStatus')}
                                        </td>
                                    )}

                                    {visibleCols.editor && (
                                        <td className={styles.cell}>
                                            {renderUserDropdown(row, index, 'editorId', 'editStatus')}
                                        </td>
                                    )}

                                    {visibleCols.caption && (
                                        <td className={styles.cell}>
                                            <div className={styles.hoverTooltipContainer}>
                                                <input
                                                    type="text"
                                                    value={row.caption || ''}
                                                    onChange={(e) => updateRow(row.id, 'caption', e.target.value)}
                                                    onKeyDown={(e) => handleFillDown(e, index, 'caption')}
                                                    placeholder="Write caption..."
                                                    className={styles.titleInput}
                                                />
                                                {/* Caption Tooltip */}
                                                <div className={styles.hoverTooltipText}>
                                                    <h4>Caption</h4>
                                                    <textarea
                                                        spellCheck={false}
                                                        className={styles.captionPopupTextarea}
                                                        value={row.caption || ''}
                                                        onChange={(e) => updateRow(row.id, 'caption', e.target.value)}
                                                        onKeyDown={(e) => handleFillDown(e, index, 'caption')}
                                                        onClick={(e) => e.stopPropagation()}
                                                        placeholder="Write detailed caption here..."
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                    )}

                                    {visibleCols.video && (
                                        <td className={styles.cell}>
                                            {row.driveLink === 'uploading...' ? (
                                                <div className={styles.uploadContainer}>
                                                    <div className={styles.progressHeader}>
                                                        <span>{uploadProgress[`${row.id}-video`] || 0}%</span>
                                                        <button className={styles.cancelBtn} onClick={() => cancelUpload(`${row.id}-video`)}>
                                                            <X size={12} /> Cancel
                                                        </button>
                                                    </div>
                                                    <div className={styles.progressBar}>
                                                        <div className={styles.progressBarFill} style={{ width: `${uploadProgress[`${row.id}-video`] || 0}%` }} />
                                                    </div>
                                                </div>
                                            ) : row.driveLink ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <a href={row.driveLink} target="_blank" rel="noopener noreferrer" className={styles.driveLinkBtn} style={{ flex: 1 }}>
                                                        <PlaySquare size={14} /> <span className={styles.fileNameStr}>File</span>
                                                    </a>
                                                    <button className={styles.actionBtn} onClick={() => handleCopy(row.driveLink!)} title="Copy Link">
                                                        {copiedLink === row.driveLink ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                                                    </button>
                                                    <button className={styles.actionBtn} onClick={() => deleteMedia(row.id, 'video')} title="Delete from Drive">
                                                        <Trash2 size={14} color="#ef4444" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <label className={styles.uploadBtn}>
                                                    <Upload size={14} /> Upload
                                                    <input
                                                        type="file"
                                                        style={{ display: 'none' }}
                                                        onChange={(e) => handleVideoUpload(row.id, e)}
                                                    />
                                                </label>
                                            )}
                                        </td>
                                    )}

                                    {visibleCols.thumbnail && (
                                        <td className={styles.cell}>
                                            {row.thumbnail === 'uploading...' ? (
                                                <div className={styles.uploadContainer}>
                                                    <div className={styles.progressHeader}>
                                                        <span>{uploadProgress[`${row.id}-thumb`] || 0}%</span>
                                                        <button className={styles.cancelBtn} onClick={() => cancelUpload(`${row.id}-thumb`)}>
                                                            <X size={12} /> Cancel
                                                        </button>
                                                    </div>
                                                    <div className={styles.progressBar}>
                                                        <div className={styles.progressBarFill} style={{ width: `${uploadProgress[`${row.id}-thumb`] || 0}%` }} />
                                                    </div>
                                                </div>
                                            ) : row.thumbnail ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <a href={row.thumbnail} target="_blank" rel="noopener noreferrer" className={styles.driveLinkBtn} style={{ flex: 1 }}>
                                                        <ImageIcon size={14} /> <span className={styles.fileNameStr}>Image</span>
                                                    </a>
                                                    <button className={styles.actionBtn} onClick={() => handleCopy(row.thumbnail!)} title="Copy Link">
                                                        {copiedLink === row.thumbnail ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                                                    </button>
                                                    <button className={styles.actionBtn} onClick={() => deleteMedia(row.id, 'thumbnail')} title="Delete from Drive">
                                                        <Trash2 size={14} color="#ef4444" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <label className={styles.uploadBtn}>
                                                    <Upload size={14} /> Upload
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        style={{ display: 'none' }}
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) handleThumbnailUpload(row.id, file);
                                                        }}
                                                    />
                                                </label>
                                            )}
                                        </td>
                                    )}

                                    {visibleCols.approved && (
                                        <td className={styles.cell}>
                                            <div className={styles.approvalContainer}>
                                                <select
                                                    value={row.approvalStatus || ''}
                                                    onChange={(e) => updateRow(row.id, 'approvalStatus', e.target.value)}
                                                    onKeyDown={(e) => handleFillDown(e as unknown as React.KeyboardEvent<HTMLElement>, index, 'approvalStatus')}
                                                    style={{
                                                        color: currentApproval.color,
                                                        backgroundColor: currentApproval.bg,
                                                        fontWeight: row.approvalStatus ? 600 : 'normal',
                                                        border: row.approvalStatus ? 'none' : '1px solid var(--border)'
                                                    }}
                                                    className={styles.statusSelect}
                                                >
                                                    {APPROVAL_STATUS.map(opt => (
                                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                    ))}
                                                </select>
                                                {row.approvalStatus === 'Changes' && (
                                                    <textarea
                                                        value={row.approvalMsg || ''}
                                                        onChange={(e) => updateRow(row.id, 'approvalMsg', e.target.value)}
                                                        onKeyDown={(e) => handleFillDown(e, index, 'approvalMsg')}
                                                        placeholder="What changes?"
                                                        className={styles.approvalTextarea}
                                                    />
                                                )}
                                            </div>
                                        </td>
                                    )}

                                    {visibleCols.socials && (
                                        <td className={styles.cell} style={{ textAlign: 'center' }}>
                                            <button className={styles.socialBtnDisabled} disabled title="Coming in v2">
                                                <Instagram size={14} />
                                            </button>
                                        </td>
                                    )}

                                    {visibleCols.keywords && (
                                        <td className={styles.cell}>
                                            <input
                                                type="text"
                                                value={row.keywords || ''}
                                                onChange={(e) => updateRow(row.id, 'keywords', e.target.value)}
                                                onKeyDown={(e) => handleFillDown(e, index, 'keywords')}
                                                placeholder="Keywords..."
                                                className={styles.titleInput}
                                            />
                                        </td>
                                    )}

                                    {visibleCols.link && (
                                        <td className={styles.cell}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <input
                                                    type="text"
                                                    value={row.link || ''}
                                                    onChange={(e) => updateRow(row.id, 'link', e.target.value)}
                                                    onKeyDown={(e) => handleFillDown(e, index, 'link')}
                                                    placeholder="Link..."
                                                    className={styles.titleInput}
                                                    style={{ flex: 1 }}
                                                />
                                                {row.link && (
                                                    <a href={row.link.startsWith('http') ? row.link : `https://${row.link}`} target="_blank" rel="noopener noreferrer" className={styles.actionBtn}>
                                                        <ExternalLink size={14} />
                                                    </a>
                                                )}
                                            </div>
                                        </td>
                                    )}

                                    {customColumns.map(c => {
                                        let cVal = '';
                                        try { cVal = row.customCols ? JSON.parse(row.customCols)[c.id] || '' : ''; } catch(e){}
                                        return (
                                            <td key={c.id} className={styles.cell}>
                                                <input
                                                    type="text"
                                                    value={cVal}
                                                    onChange={(e) => updateCustomCol(row.id, c.id, e.target.value)}
                                                    onKeyDown={(e) => handleFillDown(e, index, c.id, true)}
                                                    placeholder={c.name}
                                                    className={styles.titleInput}
                                                />
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                <button className={styles.addRowBtn} onClick={handleAddRow}>
                    <Plus size={16} /> New Row
                </button>
            </div>
        </div>
    );
}
