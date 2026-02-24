'use client';

import { useState, useCallback, useRef } from 'react';
import { Plus, Trash2, Table, Calendar, GripVertical, Hash, Type, CheckSquare, Clock, Tag, User, MoreHorizontal } from 'lucide-react';
import './database.css';

// Types
export interface Column {
    id: string;
    name: string;
    type: 'title' | 'text' | 'number' | 'select' | 'multi_select' | 'date' | 'checkbox' | 'person' | 'url';
    width?: number;
    options?: string[];
}

export interface Row {
    id: string;
    properties: Record<string, any>;
    position: number;
}

interface DatabaseTableViewProps {
    databaseId: string;
    title: string;
    icon?: string;
    columns: Column[];
    rows: Row[];
    onTitleChange: (title: string) => void;
    onColumnsChange: (columns: Column[]) => void;
    onRowAdd: () => void;
    onRowUpdate: (rowId: string, properties: Record<string, any>) => void;
    onRowDelete: (rowId: string) => void;
    onColumnAdd: (column: Column) => void;
    onDelete?: () => void;
}

const COLUMN_TYPE_ICONS: Record<string, any> = {
    title: Type,
    text: Type,
    number: Hash,
    select: Tag,
    multi_select: Tag,
    date: Clock,
    checkbox: CheckSquare,
    person: User,
    url: Type,
};

const BADGE_COLORS = ['db-badge-0', 'db-badge-1', 'db-badge-2', 'db-badge-3', 'db-badge-4', 'db-badge-5', 'db-badge-6', 'db-badge-7'];

function getBadgeColor(value: string, options: string[] = []) {
    const idx = options.indexOf(value);
    return BADGE_COLORS[idx >= 0 ? idx % BADGE_COLORS.length : 0];
}

// ---- Select Dropdown ----
function SelectDropdown({
    options, value, multi, onChange, onClose, anchorRect,
}: {
    options: string[];
    value: string | string[];
    multi: boolean;
    onChange: (val: string | string[]) => void;
    onClose: () => void;
    anchorRect: DOMRect | null;
}) {
    const selected = multi ? (Array.isArray(value) ? value : []) : value;

    const toggle = (opt: string) => {
        if (multi) {
            const arr = Array.isArray(selected) ? selected : [];
            if (arr.includes(opt)) {
                onChange(arr.filter(v => v !== opt));
            } else {
                onChange([...arr, opt]);
            }
        } else {
            onChange(opt);
            onClose();
        }
    };

    return (
        <div
            className="db-select-dropdown"
            style={{
                position: 'fixed',
                top: anchorRect ? anchorRect.bottom + 2 : 0,
                left: anchorRect ? anchorRect.left : 0,
            }}
            onMouseDown={e => e.stopPropagation()}
        >
            {options.map(opt => (
                <div
                    key={opt}
                    className={`db-select-option ${multi ? (Array.isArray(selected) && selected.includes(opt) ? 'selected' : '') : (selected === opt ? 'selected' : '')}`}
                    onClick={() => toggle(opt)}
                >
                    <span className={`db-select-badge ${getBadgeColor(opt, options)}`}>{opt}</span>
                </div>
            ))}
        </div>
    );
}

// ---- Cell Renderer ----
function CellRenderer({
    column, value, onChange,
}: {
    column: Column;
    value: any;
    onChange: (val: any) => void;
}) {
    const [editing, setEditing] = useState(false);
    const [selectOpen, setSelectOpen] = useState(false);
    const cellRef = useRef<HTMLDivElement>(null);

    switch (column.type) {
        case 'title':
        case 'text':
        case 'url':
            return (
                <div className={`db-cell ${column.type === 'title' ? 'db-cell-title' : ''}`}>
                    <input
                        className="db-cell-input"
                        value={value || ''}
                        onChange={e => onChange(e.target.value)}
                        placeholder={column.type === 'title' ? 'Untitled' : ''}
                    />
                </div>
            );

        case 'number':
            return (
                <div className="db-cell">
                    <input
                        type="number"
                        className="db-cell-input"
                        value={value ?? ''}
                        onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
                    />
                </div>
            );

        case 'checkbox':
            return (
                <div className="db-cell db-cell-checkbox">
                    <input
                        type="checkbox"
                        checked={!!value}
                        onChange={e => onChange(e.target.checked)}
                    />
                </div>
            );

        case 'date':
            return (
                <div className="db-cell db-cell-date">
                    <input
                        type="date"
                        value={value || ''}
                        onChange={e => onChange(e.target.value)}
                    />
                </div>
            );

        case 'select':
            return (
                <div ref={cellRef} className="db-cell" onClick={() => setSelectOpen(!selectOpen)}>
                    <div className="db-select-wrapper">
                        {value ? (
                            <span className={`db-select-badge ${getBadgeColor(value, column.options)}`}>{value}</span>
                        ) : (
                            <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Select...</span>
                        )}
                    </div>
                    {selectOpen && (
                        <SelectDropdown
                            options={column.options || []}
                            value={value || ''}
                            multi={false}
                            onChange={(v) => { onChange(v); setSelectOpen(false); }}
                            onClose={() => setSelectOpen(false)}
                            anchorRect={cellRef.current?.getBoundingClientRect() || null}
                        />
                    )}
                </div>
            );

        case 'multi_select':
            return (
                <div ref={cellRef} className="db-cell" onClick={() => setSelectOpen(!selectOpen)}>
                    <div className="db-select-wrapper">
                        {Array.isArray(value) && value.length > 0 ? (
                            value.map((v: string) => (
                                <span key={v} className={`db-select-badge ${getBadgeColor(v, column.options)}`}>{v}</span>
                            ))
                        ) : (
                            <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Select...</span>
                        )}
                    </div>
                    {selectOpen && (
                        <SelectDropdown
                            options={column.options || []}
                            value={value || []}
                            multi={true}
                            onChange={(v) => onChange(v)}
                            onClose={() => setSelectOpen(false)}
                            anchorRect={cellRef.current?.getBoundingClientRect() || null}
                        />
                    )}
                </div>
            );

        case 'person':
            return (
                <div className="db-cell">
                    <input
                        className="db-cell-input"
                        value={value || ''}
                        onChange={e => onChange(e.target.value)}
                        placeholder="Person"
                    />
                </div>
            );

        default:
            return (
                <div className="db-cell">
                    <input
                        className="db-cell-input"
                        value={value || ''}
                        onChange={e => onChange(e.target.value)}
                    />
                </div>
            );
    }
}

// ---- Main Component ----
export default function DatabaseTableView({
    databaseId,
    title,
    icon,
    columns,
    rows,
    onTitleChange,
    onColumnsChange,
    onRowAdd,
    onRowUpdate,
    onRowDelete,
    onColumnAdd,
    onDelete,
}: DatabaseTableViewProps) {
    const [activeView, setActiveView] = useState('table');
    const titleTimerRef = useRef<NodeJS.Timeout>(undefined);

    const handleTitleInput = (val: string) => {
        if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
        titleTimerRef.current = setTimeout(() => onTitleChange(val), 400);
    };

    const handleCellChange = useCallback((rowId: string, colId: string, value: any, currentProps: Record<string, any>) => {
        onRowUpdate(rowId, { ...currentProps, [colId]: value });
    }, [onRowUpdate]);

    const addNewColumn = () => {
        const id = `col_${Date.now()}`;
        onColumnAdd({ id, name: 'New Column', type: 'text', width: 150 });
    };

    const handleColumnRename = (colId: string, newName: string) => {
        const updated = columns.map(c => c.id === colId ? { ...c, name: newName } : c);
        onColumnsChange(updated);
    };

    return (
        <div className="db-container">
            {/* Database header */}
            <div className="db-header">
                <div className="db-title-wrap">
                    <span className="db-icon">{icon || '🗃️'}</span>
                    <input
                        className="db-title"
                        defaultValue={title}
                        onChange={e => handleTitleInput(e.target.value)}
                    />
                </div>
                <div className="db-actions">
                    <button className="db-action-btn" onClick={onRowAdd}>
                        <Plus size={14} /> New
                    </button>
                    {onDelete && (
                        <button className="db-action-btn" onClick={onDelete} title="Delete database">
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* View tabs */}
            <div className="db-views">
                <button
                    className={`db-view-tab ${activeView === 'table' ? 'active' : ''}`}
                    onClick={() => setActiveView('table')}
                >
                    <Table size={14} /> Table
                </button>
                <button
                    className={`db-view-tab ${activeView === 'calendar' ? 'active' : ''}`}
                    onClick={() => setActiveView('calendar')}
                >
                    <Calendar size={14} /> Calendar
                </button>
            </div>

            {/* Table view */}
            {activeView === 'table' && (
                <div className="db-table-wrap">
                    <table className="db-table">
                        <thead>
                            <tr>
                                {columns.map(col => {
                                    const Icon = COLUMN_TYPE_ICONS[col.type] || Type;
                                    return (
                                        <th key={col.id} style={{ width: col.width || 150, minWidth: 100 }}>
                                            <div className="db-col-header">
                                                <Icon size={14} className="db-col-icon" />
                                                <input
                                                    className="db-col-name-input"
                                                    defaultValue={col.name}
                                                    onBlur={e => handleColumnRename(col.id, e.target.value)}
                                                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                                />
                                            </div>
                                        </th>
                                    );
                                })}
                                <th className="db-add-col" onClick={addNewColumn}>
                                    <Plus size={14} />
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(row => (
                                <tr key={row.id}>
                                    {columns.map(col => (
                                        <td key={col.id} style={{ width: col.width || 150 }}>
                                            <CellRenderer
                                                column={col}
                                                value={row.properties[col.id]}
                                                onChange={(val) => handleCellChange(row.id, col.id, val, row.properties)}
                                            />
                                        </td>
                                    ))}
                                    <td style={{ width: 40 }}>
                                        <div className="db-row-actions">
                                            <button className="db-row-action-btn" onClick={() => onRowDelete(row.id)} title="Delete">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {/* Add row button */}
                    <button className="db-add-row" onClick={onRowAdd}>
                        <Plus size={14} /> New
                    </button>
                    {/* Summary */}
                    <div className="db-summary">
                        {rows.length} {rows.length === 1 ? 'row' : 'rows'}
                    </div>
                </div>
            )}

            {/* Calendar view placeholder */}
            {activeView === 'calendar' && (
                <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                    Calendar view coming soon
                </div>
            )}
        </div>
    );
}
