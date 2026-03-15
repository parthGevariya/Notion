'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Topbar from '@/components/Topbar/Topbar';
import DatabaseTableView, { Column, Row } from '@/components/Database/DatabaseTableView';

interface DatabaseData {
    id: string;
    title: string;
    icon: string | null;
    schema: Column[];
    viewConfig: any;
    rows: Row[];
}

export default function DatabasePage() {
    const { status } = useSession();
    const router = useRouter();
    const params = useParams();
    const dbId = params?.id as string;

    const [db, setDb] = useState<DatabaseData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (status === 'unauthenticated') router.push('/login');
    }, [status, router]);

    const fetchDb = useCallback(async () => {
        try {
            const res = await fetch(`/api/databases/${dbId}`);
            if (res.ok) setDb(await res.json());
        } catch (e) {
            console.error('Failed to load database', e);
        } finally {
            setLoading(false);
        }
    }, [dbId]);

    useEffect(() => { fetchDb(); }, [fetchDb]);

    const handleTitleChange = useCallback(async (title: string) => {
        await fetch(`/api/databases/${dbId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title }),
        });
    }, [dbId]);

    const handleColumnsChange = useCallback(async (columns: Column[]) => {
        setDb(prev => prev ? { ...prev, schema: columns } : null);
        await fetch(`/api/databases/${dbId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ schema: columns }),
        });
    }, [dbId]);

    const handleColumnAdd = useCallback(async (column: Column) => {
        if (!db) return;
        const newCols = [...db.schema, column];
        setDb(prev => prev ? { ...prev, schema: newCols } : null);
        await fetch(`/api/databases/${dbId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ schema: newCols }),
        });
    }, [db, dbId]);

    const handleRowAdd = useCallback(async () => {
        const res = await fetch(`/api/databases/${dbId}/rows`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ properties: {} }),
        });
        if (res.ok) {
            const newRow = await res.json();
            setDb(prev => prev ? { ...prev, rows: [...prev.rows, newRow] } : null);
        }
    }, [dbId]);

    const handleRowUpdate = useCallback(async (rowId: string, properties: Record<string, any>) => {
        setDb(prev => {
            if (!prev) return null;
            return { ...prev, rows: prev.rows.map(r => r.id === rowId ? { ...r, properties } : r) };
        });
        await fetch(`/api/databases/${dbId}/rows`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rowId, properties }),
        });
    }, [dbId]);

    const handleRowDelete = useCallback(async (rowId: string) => {
        setDb(prev => {
            if (!prev) return null;
            return { ...prev, rows: prev.rows.filter(r => r.id !== rowId) };
        });
        await fetch(`/api/databases/${dbId}/rows`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rowId }),
        });
    }, [dbId]);

    if (status === 'loading' || loading) {
        return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-secondary)' }}>Loading...</div>;
    }

    if (!db) {
        return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-secondary)' }}>Database not found</div>;
    }

    return (
        <div style={{ flex: 1, marginLeft: 'var(--sidebar-width)', display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100vh', background: 'var(--bg-primary)' }}>
            <Topbar page={{ id: db.id, title: db.title, icon: db.icon }} />
            <div style={{ flex: 1, overflow: 'auto', padding: '0 96px' }}>
                <div style={{ maxWidth: '100%', padding: '40px 0' }}>
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
                    />
                </div>
            </div>
        </div>
    );
}
