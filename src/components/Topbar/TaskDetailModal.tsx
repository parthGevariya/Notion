import React, { useState } from 'react';
import { format } from 'date-fns';
import { Check, Clock, X, AlertCircle } from 'lucide-react';
import styles from './TaskDetailModal.module.css';

interface TaskDetailModalProps {
    task: any;
    onClose: () => void;
    onUpdate: (updatedTask: any) => void;
    currentUserId: string;
}

export default function TaskDetailModal({ task, onClose, onUpdate, currentUserId }: TaskDetailModalProps) {
    const [loading, setLoading] = useState(false);

    const handleAction = async (actionType: 'complete' | 'approve' | 'request_changes') => {
        setLoading(true);
        try {
            const body: any = {};

            if (actionType === 'complete') {
                body.reviewStatus = 'pending_review';
            } else if (actionType === 'approve') {
                body.reviewStatus = 'approved';
            } else if (actionType === 'request_changes') {
                body.reviewStatus = 'changes_requested';
            }

            const res = await fetch(`/api/reminders/${task.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                const updated = await res.json();
                onUpdate(updated);
                onClose();
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const isAssignee = task.assigneeId === currentUserId;
    const isCreator = task.creatorId === currentUserId;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h3 className={styles.title}>{task.title}</h3>
                    <button className={styles.closeBtn} onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>

                <div className={styles.body}>
                    <div className={styles.meta}>
                        <div className={styles.metaItem}>
                            <strong>Assignee:</strong> {task.assignee?.name}
                        </div>
                        <div className={styles.metaItem}>
                            <strong>Assigned By:</strong> {task.creator?.name}
                        </div>
                        <div className={styles.metaItem}>
                            <strong>Deadline:</strong> {format(new Date(task.endDate), 'PP p')}
                        </div>
                        <div className={styles.metaItem}>
                            <strong>Status:</strong> <span className={styles.statusBadge}>{task.status.replace('_', ' ')}</span>
                        </div>
                    </div>

                    {task.description && (
                        <div className={styles.descriptionBlock}>
                            <h4>Description</h4>
                            <p>{task.description}</p>
                        </div>
                    )}
                </div>

                <div className={styles.footer}>
                    {/* Assignee Actions */}
                    {isAssignee && task.status !== 'completed' && task.status !== 'in_review' && (
                        <button
                            className={styles.completeActionBtn}
                            onClick={() => handleAction('complete')}
                            disabled={loading}
                        >
                            <Check size={16} /> Mark as Complete (Submit for Review)
                        </button>
                    )}

                    {/* Creator Actions (Reviewing) */}
                    {isCreator && task.status === 'in_review' && (
                        <div className={styles.reviewActions}>
                            <button
                                className={styles.rejectBtn}
                                onClick={() => handleAction('request_changes')}
                                disabled={loading}
                            >
                                <AlertCircle size={16} /> Request Changes
                            </button>
                            <button
                                className={styles.approveBtn}
                                onClick={() => handleAction('approve')}
                                disabled={loading}
                            >
                                <Check size={16} /> Approve & Close
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
