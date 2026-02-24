'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Settings, Users, Shield, Trash2, Edit3 } from 'lucide-react';
import Sidebar from '@/components/Sidebar/Sidebar';
import { ROLE_LABELS } from '@/lib/types';
import type { Role } from '@/lib/types';

interface WorkspaceUser {
    id: string;
    name: string;
    email: string;
    role: string;
    avatar: string | null;
    isActive: boolean;
    createdAt: string;
}

export default function SettingsPage() {
    const { data: session, status: authStatus } = useSession();
    const router = useRouter();
    const [users, setUsers] = useState<WorkspaceUser[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editRole, setEditRole] = useState('');
    const currentRole = (session?.user as any)?.role;
    const canManage = currentRole === 'owner' || currentRole === 'manager';

    useEffect(() => {
        if (authStatus === 'unauthenticated') router.push('/login');
    }, [authStatus, router]);

    useEffect(() => {
        fetch('/api/users')
            .then(r => r.ok ? r.json() : [])
            .then(setUsers)
            .catch(() => { });
    }, []);

    const handleRoleChange = async (userId: string, newRole: string) => {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
        setEditingId(null);
        await fetch(`/api/users/${userId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: newRole }),
        });
    };

    if (authStatus === 'loading') {
        return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-secondary)' }}>Loading...</div>;
    }

    if (!session) return null;

    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            <Sidebar />
            <div style={{ flex: 1, marginLeft: 'var(--sidebar-width)', minHeight: '100vh' }}>
                <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 32px' }}>
                    <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
                        <Settings size={24} /> Settings
                    </h1>

                    {/* Workspace Info */}
                    <div style={{
                        padding: 20, background: 'var(--bg-secondary)', borderRadius: 8,
                        border: '1px solid var(--divider)', marginBottom: 32,
                    }}>
                        <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Shield size={16} /> Your Role
                        </h2>
                        <div style={{
                            display: 'inline-flex', padding: '4px 12px', borderRadius: 4,
                            background: 'rgba(52,152,219,0.15)', color: '#2980b9', fontSize: 13, fontWeight: 600,
                        }}>
                            {ROLE_LABELS[currentRole as Role] || currentRole}
                        </div>
                    </div>

                    {/* User Management */}
                    <div style={{
                        border: '1px solid var(--divider)', borderRadius: 8, overflow: 'hidden',
                    }}>
                        <div style={{
                            padding: '12px 16px', background: 'var(--bg-secondary)',
                            borderBottom: '1px solid var(--divider)', display: 'flex', alignItems: 'center', gap: 8,
                            fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
                        }}>
                            <Users size={16} /> Team Members ({users.length})
                        </div>

                        {users.map(user => (
                            <div key={user.id} style={{
                                display: 'flex', alignItems: 'center', gap: 12,
                                padding: '12px 16px', borderBottom: '1px solid var(--divider)',
                            }}>
                                <div style={{
                                    width: 36, height: 36, borderRadius: '50%',
                                    background: user.id === (session.user as any).id ? '#2ecc71' : 'var(--accent-blue)',
                                    color: 'white', fontSize: 14, fontWeight: 600,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    {user.name.charAt(0).toUpperCase()}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                                        {user.name}
                                        {user.id === (session.user as any).id && (
                                            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 6 }}>(you)</span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{user.email}</div>
                                </div>

                                {editingId === user.id ? (
                                    <select
                                        value={editRole}
                                        onChange={e => handleRoleChange(user.id, e.target.value)}
                                        onBlur={() => setEditingId(null)}
                                        autoFocus
                                        style={{
                                            padding: '4px 8px', borderRadius: 4, border: '1px solid var(--divider)',
                                            background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 13,
                                        }}
                                    >
                                        {Object.entries(ROLE_LABELS).map(([val, label]) => (
                                            <option key={val} value={val}>{label}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{
                                            padding: '3px 10px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                                            background: 'var(--bg-hover)', color: 'var(--text-secondary)',
                                        }}>
                                            {ROLE_LABELS[user.role as Role] || user.role}
                                        </span>
                                        {canManage && user.id !== (session.user as any).id && (
                                            <button
                                                onClick={() => { setEditingId(user.id); setEditRole(user.role); }}
                                                style={{
                                                    padding: 4, border: 'none', background: 'none', cursor: 'pointer',
                                                    color: 'var(--text-tertiary)', borderRadius: 4,
                                                }}
                                                title="Change role"
                                            >
                                                <Edit3 size={14} />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
