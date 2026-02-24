'use client';

import { useState, useEffect, useCallback } from 'react';
import DatabaseTableView, { Column, Row } from './DatabaseTableView';

interface InlineDatabaseBlockProps {
    databaseId: string;
    pageId: string;
    onDelete?: () => void;
}

export default function InlineDatabaseBlock({ databaseId, pageId, onDelete }: InlineDatabaseBlockProps) {
    const [db, setDb] = useState<{
        id: string; title: string; icon: string | null;
        schema: Column[]; rows: Row[];
    } | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchDb = useCallback(async () => {
        try {
            const res = await fetch(`/api/databases/${databaseId}`);
            if (res.ok) setDb(await res.json());
        } catch (e) {
            console.error('Failed to load database', e);
        } finally {
            setLoading(false);
        }
    }, [databaseId]);

    useEffect(() => { fetchDb(); }, [fetchDb]);

    const handleTitleChange = useCallback(async (title: string) => {
        await fetch(`/api/databases/${databaseId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title }),
        });
    }, [databaseId]);

    const handleColumnsChange = useCallback(async (columns: Column[]) => {
        setDb(prev => prev ? { ...prev, schema: columns } : null);
        await fetch(`/api/databases/${databaseId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ schema: columns }),
        });
    }, [databaseId]);

    const handleColumnAdd = useCallback(async (column: Column) => {
        if (!db) return;
        const newCols = [...db.schema, column];
        setDb(prev => prev ? { ...prev, schema: newCols } : null);
        await fetch(`/api/databases/${databaseId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ schema: newCols }),
        });
    }, [db, databaseId]);

    const handleRowAdd = useCallback(async () => {
        const res = await fetch(`/api/databases/${databaseId}/rows`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ properties: {} }),
        });
        if (res.ok) {
            const newRow = await res.json();
            setDb(prev => prev ? { ...prev, rows: [...prev.rows, newRow] } : null);
        }
    }, [databaseId]);

    const handleRowUpdate = useCallback(async (rowId: string, properties: Record<string, any>) => {
        setDb(prev => {
            if (!prev) return null;
            return { ...prev, rows: prev.rows.map(r => r.id === rowId ? { ...r, properties } : r) };
        });
        await fetch(`/api/databases/${databaseId}/rows`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rowId, properties }),
        });
    }, [databaseId]);

    const handleRowDelete = useCallback(async (rowId: string) => {
        setDb(prev => {
            if (!prev) return null;
            return { ...prev, rows: prev.rows.filter(r => r.id !== rowId) };
        });
        await fetch(`/api/databases/${databaseId}/rows`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rowId }),
        });
    }, [databaseId]);

    if (loading) {
        return <div style={{ padding: '12px 0', color: 'var(--text-tertiary)', fontSize: 14 }}>Loading database...</div>;
    }

    if (!db) {
        return <div style={{ padding: '12px 0', color: 'var(--text-tertiary)', fontSize: 14 }}>Database not found</div>;
    }

    return (
        <div style={{ margin: '16px 0' }}>
            <DatabaseTableView
                databaseId={db.id}
                title={db.title}
                icon={db.icon || undefined}
                columns={db.schema}
                rows={db.rows}
                onTitleChange={handleTitleChange}
                onColumnsChange={handleColumnsChange}
                onRowAdd={handleRowAdd}
                onRowUpdate={handleRowUpdate}
                onRowDelete={handleRowDelete}
                onColumnAdd={handleColumnAdd}
                onDelete={onDelete}
            />
        </div>
    );
}
