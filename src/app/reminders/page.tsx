'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Clock, User, CalendarDays, Bell, Paperclip, X, File as FileIcon, ImageIcon } from 'lucide-react';
import Sidebar from '@/components/Sidebar/Sidebar';
import Topbar from '@/components/Topbar/Topbar';
import TaskDetailModal from '@/components/Topbar/TaskDetailModal';
import './reminders.css';

interface ReminderUser {
    id: string;
    name: string;
    avatar: string | null;
}

interface Reminder {
    id: string;
    title: string;
    details: string | null;
    assignee: ReminderUser;
    creator: ReminderUser;
    endDate: string;
    status: string;
    completedAt: string | null;
    parentId: string | null;
    attachmentUrl: string | null;
    attachmentName: string | null;
    attachmentType: string | null;
}

const STATUS_LABELS: Record<string, string> = {
    pending: 'Pending',
    in_progress: 'In Progress',
    completed: 'Completed',
    overdue: 'Overdue',
};

export default function RemindersPage() {
    const { data: session, status: authStatus } = useSession();
    const router = useRouter();
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [filter, setFilter] = useState('all');
    const [showForm, setShowForm] = useState(false);
    const [users, setUsers] = useState<ReminderUser[]>([]);
    const [selectedTask, setSelectedTask] = useState<Reminder | null>(null);

    // Form state
    const [formTitle, setFormTitle] = useState('');
    const [formDetails, setFormDetails] = useState('');
    const [formAssignee, setFormAssignee] = useState('');
    const [formEndDate, setFormEndDate] = useState('');
    const [attachment, setAttachment] = useState<{ url: string; name: string; type: string } | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);

    useEffect(() => {
        if (authStatus === 'unauthenticated') router.push('/login');
    }, [authStatus, router]);

    // Fetch reminders
    const fetchReminders = useCallback(async () => {
        const res = await fetch(`/api/reminders?filter=${filter}`);
        if (res.ok) setReminders(await res.json());
    }, [filter]);

    useEffect(() => { fetchReminders(); }, [fetchReminders]);

    // Fetch users for assignee dropdown
    useEffect(() => {
        fetch('/api/users')
            .then(r => r.ok ? r.json() : [])
            .then(setUsers)
            .catch(() => { });
    }, []);
    
    const handleFileUpload = async (file: File) => {
        if (!file) return;
        setUploading(true);
        setUploadError(null);
        
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            const res = await fetch('/api/upload/reminder', {
                method: 'POST',
                body: formData
            });
            if (res.ok) {
                const data = await res.json();
                setAttachment(data);
            } else {
                const error = await res.json();
                setUploadError(error.error || 'Upload failed');
            }
        } catch (e) {
            setUploadError('Network error');
        } finally {
            setUploading(false);
        }
    };
    
    const handlePaste = async (e: React.ClipboardEvent) => {
        const items = Array.from(e.clipboardData.items);
        const fileItem = items.find(i => i.kind === 'file');
        if (fileItem) {
            const file = fileItem.getAsFile();
            if (file) handleFileUpload(file);
        }
    };

    const handleCreate = async () => {
        if (!formTitle || !formAssignee || !formEndDate) return;

        try {
            const res = await fetch('/api/reminders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: formTitle,
                    description: formDetails || null, // Map formDetails to description for the modal
                    details: formDetails || null,
                    assigneeId: formAssignee,
                    endDate: formEndDate,
                    attachmentUrl: attachment?.url,
                    attachmentName: attachment?.name,
                    attachmentType: attachment?.type,
                }),
            });

            if (res.ok) {
                const reminder = await res.json();
                setReminders(prev => [reminder, ...prev]);
                setFormTitle(''); setFormDetails(''); setFormAssignee(''); setFormEndDate('');
                setAttachment(null);
                setShowForm(false);
            } else {
                const data = await res.json();
                alert(`Error: ${data.error || 'Failed to create reminder'}\nDetails: ${data.details || 'No details'}`);
            }
        } catch (err) {
            console.error(err);
            alert('Failed to connect to the server.');
        }
    };

    const handleStatusToggle = async (id: string, currentStatus: string) => {
        // Obsolete function, replaced by TaskDetailModal
    };

    const handleDelete = async (id: string) => {
        setReminders(prev => prev.filter(r => r.id !== id));
        await fetch(`/api/reminders/${id}`, { method: 'DELETE' });
    };

    const isOverdue = (r: Reminder) =>
        r.status !== 'completed' && new Date(r.endDate) < new Date();

    const formatDate = (d: string) => {
        const date = new Date(d);
        return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const getTimeRemaining = (endDate: string) => {
        const diff = new Date(endDate).getTime() - Date.now();
        if (diff < 0) return 'Overdue';
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);
        if (days > 0) return `${days}d ${hours % 24}h left`;
        return `${hours}h left`;
    };

    if (authStatus === 'loading') {
        return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-secondary)' }}>Loading...</div>;
    }

    if (!session) return null;

    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            <Sidebar />
            <div style={{ flex: 1, marginLeft: 'var(--sidebar-width)', minHeight: '100vh' }}>
                <div className="reminders-page">
                    {/* Header */}
                    <div className="reminders-header">
                        <div className="reminders-title">
                            <Bell size={24} /> Reminders
                        </div>
                        <button
                            className="reminder-form-btn"
                            onClick={() => setShowForm(!showForm)}
                        >
                            <Plus size={14} style={{ marginRight: 4 }} /> New Reminder
                        </button>
                    </div>

                    {/* Create Form */}
                    {showForm && (
                        <div className="reminder-form">
                            <div className="reminder-form-row">
                                <input
                                    className="reminder-form-input"
                                    value={formTitle}
                                    onChange={e => setFormTitle(e.target.value)}
                                    placeholder="Reminder title..."
                                />
                            </div>
                            <div className="reminder-form-row">
                                <textarea
                                    className="reminder-form-input"
                                    value={formDetails}
                                    onChange={e => setFormDetails(e.target.value)}
                                    placeholder="Details / Description (optional)..."
                                    rows={3}
                                    style={{ resize: 'vertical' }}
                                    onPaste={handlePaste}
                                />
                            </div>
                            <div className="reminder-form-row">
                                <label className="reminder-file-upload">
                                    <input 
                                        type="file" 
                                        style={{ display: 'none' }} 
                                        onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])} 
                                    />
                                    <Paperclip size={16} /> 
                                    {uploading ? 'Uploading...' : 'Attach File (max 500MB) or Paste Image'}
                                </label>
                                {attachment && (
                                    <div className="form-attachment-preview">
                                        {attachment.type === 'image' ? <ImageIcon size={14} /> : <FileIcon size={14} />}
                                        <span>{attachment.name}</span>
                                        <button onClick={() => setAttachment(null)} className="remove-att-btn"><X size={14} /></button>
                                    </div>
                                )}
                                {uploadError && <div className="error-text">{uploadError}</div>}
                            </div>
                            <div className="reminder-form-row">
                                <select
                                    className="reminder-form-select"
                                    value={formAssignee}
                                    onChange={e => setFormAssignee(e.target.value)}
                                >
                                    <option value="">Assign to...</option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.id}>{u.name}</option>
                                    ))}
                                </select>
                                <input
                                    type="datetime-local"
                                    className="reminder-form-input"
                                    value={formEndDate}
                                    onChange={e => setFormEndDate(e.target.value)}
                                />
                                <button className="reminder-form-btn" onClick={handleCreate}>
                                    Create
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Filter tabs */}
                    <div className="reminders-filters">
                        {['all', 'assigned', 'created'].map(f => (
                            <button
                                key={f}
                                className={`reminder-filter-tab ${filter === f ? 'active' : ''}`}
                                onClick={() => setFilter(f)}
                            >
                                {f === 'all' ? 'All' : f === 'assigned' ? 'Assigned to Me' : 'Created by Me'}
                            </button>
                        ))}
                    </div>

                    {/* Reminder list */}
                    {reminders.length === 0 ? (
                        <div className="reminders-empty">
                            No reminders yet. Click "New Reminder" to create one.
                        </div>
                    ) : (
                        <div className="reminder-list">
                            {reminders.map(r => (
                                <div
                                    key={r.id}
                                    className={`reminder-card ${r.status === 'completed' ? 'completed' : ''} ${isOverdue(r) ? 'overdue' : ''}`}
                                    onClick={() => setSelectedTask(r)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div className="reminder-content">
                                        <div className="reminder-card-title" style={{ textDecoration: r.status === 'completed' ? 'line-through' : 'none' }}>
                                            {r.title}
                                        </div>
                                        {r.details && (
                                            <div className="reminder-card-details">{r.details}</div>
                                        )}
                                        <div className="reminder-card-meta">
                                            <span className={`reminder-status-badge reminder-status-${isOverdue(r) ? 'overdue' : r.status}`}>
                                                {isOverdue(r) ? 'Overdue' : STATUS_LABELS[r.status] || r.status}
                                            </span>
                                            <span className="reminder-card-meta-item">
                                                <CalendarDays size={12} /> {formatDate(r.endDate)}
                                            </span>
                                            <span className="reminder-card-meta-item">
                                                <Clock size={12} /> {getTimeRemaining(r.endDate)}
                                            </span>
                                            <span className="reminder-card-meta-item">
                                                <User size={12} />
                                                <span className="reminder-user-avatar">{r.assignee.name.charAt(0)}</span>
                                                {r.assignee.name}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        className="reminder-delete-btn"
                                        onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }}
                                        title="Delete"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {selectedTask && (
                <TaskDetailModal
                    task={selectedTask}
                    currentUserId={(session?.user as any).id}
                    onClose={() => setSelectedTask(null)}
                    onUpdate={(updated) => {
                        setReminders(prev => prev.map(r => r.id === updated.id ? updated : r));
                        setSelectedTask(null);
                    }}
                />
            )}
        </div>
    );
}
