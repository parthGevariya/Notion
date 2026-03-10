'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Upload, ExternalLink, PlaySquare, Settings2, Instagram, ImageIcon } from 'lucide-react';
import { useSession } from 'next-auth/react';
import styles from './ClientCalendarView.module.css';

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

    useEffect(() => {
        fetchData();
    }, [pageId]);

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

    const handleThumbnailUpload = async (rowId: string, file: File) => {
        if (!page?.clientId) return;
        setRows(prev => prev.map(r => r.id === rowId ? { ...r, thumbnail: 'uploading...' } : r));
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await fetch(`/api/clients/${page.clientId}/calendar/${rowId}/upload-thumbnail`, {
                method: 'POST',
                body: formData
            });
            if (res.ok) {
                const data = await res.json();
                setRows(prev => prev.map(r => r.id === rowId ? { ...r, thumbnail: data.thumbnail } : r));
            } else {
                fetchData();
            }
        } catch (err) {
            console.error('Upload failed', err);
            fetchData();
        }
    };

    const handleVideoUpload = async (rowId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        if (!page?.clientId || !e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
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
                fetchData();
            }
        } catch (err) {
            console.error('Upload failed', err);
            fetchData();
        }
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

    const renderUserDropdown = (row: CalendarRow, field: 'shootPersonId' | 'editorId', statusField: 'shootStatus' | 'editStatus') => {
        const status = SHOOT_EDIT_STATUS.find(s => s.value === row[statusField]) || SHOOT_EDIT_STATUS[0];
        const value = row[field] || '';
        return (
            <select
                value={value}
                onChange={(e) => updateRow(row.id, field, e.target.value || null)}
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

    const renderStatusDropdown = (row: CalendarRow, field: 'shootStatus' | 'editStatus') => {
        const currentStatus = SHOOT_EDIT_STATUS.find(s => s.value === row[field]) || SHOOT_EDIT_STATUS[0];
        return (
            <select
                value={row[field]}
                onChange={(e) => updateRow(row.id, field, e.target.value)}
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
                    <div style={{ position: 'relative', marginLeft: 'auto' }}>
                        <button className={styles.colToggleBtn} onClick={() => setShowColMenu(!showColMenu)}>
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
                            {visibleCols.video && <th style={{ width: '120px' }}>Video</th>}
                            {visibleCols.thumbnail && <th style={{ width: '120px' }}>Thumbnail</th>}
                            {visibleCols.approved && <th style={{ width: '150px' }}>Approved</th>}
                            {visibleCols.socials && <th style={{ width: '80px' }}>Socials</th>}
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
                                            {renderStatusDropdown(row, 'shootStatus')}
                                        </td>
                                    )}

                                    {visibleCols.person && (
                                        <td className={styles.cell}>
                                            {renderUserDropdown(row, 'shootPersonId', 'shootStatus')}
                                        </td>
                                    )}

                                    {visibleCols.edit && (
                                        <td className={styles.cell}>
                                            {renderStatusDropdown(row, 'editStatus')}
                                        </td>
                                    )}

                                    {visibleCols.editor && (
                                        <td className={styles.cell}>
                                            {renderUserDropdown(row, 'editorId', 'editStatus')}
                                        </td>
                                    )}

                                    {visibleCols.caption && (
                                        <td className={styles.cell}>
                                            <div className={styles.hoverTooltipContainer}>
                                                <input
                                                    type="text"
                                                    value={row.caption || ''}
                                                    onChange={(e) => updateRow(row.id, 'caption', e.target.value)}
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
                                                <span className={styles.uploadingText}>Uploading...</span>
                                            ) : row.driveLink ? (
                                                <a href={row.driveLink} target="_blank" rel="noopener noreferrer" className={styles.driveLinkBtn}>
                                                    <PlaySquare size={14} /> Video
                                                </a>
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
                                                <span className={styles.uploadingText}>Uploading...</span>
                                            ) : row.thumbnail ? (
                                                <a href={row.thumbnail} target="_blank" rel="noopener noreferrer" className={styles.driveLinkBtn}>
                                                    <ImageIcon size={14} /> View
                                                </a>
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
