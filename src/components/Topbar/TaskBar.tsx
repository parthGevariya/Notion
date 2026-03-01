'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Clock, AlertCircle } from 'lucide-react';
import { differenceInHours, differenceInDays } from 'date-fns';
import TaskDetailModal from './TaskDetailModal';
import styles from './TaskBar.module.css';

export default function TaskBar() {
    const { data: session } = useSession();
    const [tasks, setTasks] = useState<any[]>([]);
    const [selectedTask, setSelectedTask] = useState<any | null>(null);

    useEffect(() => {
        if (!session?.user) return;
        fetchTasks();
    }, [session]);

    const fetchTasks = async () => {
        try {
            // Fetch tasks where the user is either assignee or creator
            const res = await fetch('/api/reminders?filter=all');
            if (res.ok) {
                const data = await res.json();
                // Filter down to tasks that need attention:
                // 1. Assigned to me AND status is pending or in_progress or changes_requested or overdue
                // 2. Assigned BY me AND status is in_review
                const currentUserId = (session?.user as any).id;

                const activeTasks = data.filter((t: any) => {
                    if (t.assigneeId === currentUserId) {
                        return t.status !== 'completed' && t.status !== 'in_review';
                    }
                    if (t.creatorId === currentUserId) {
                        return t.status === 'in_review';
                    }
                    return false;
                });

                // Sort by deadline
                activeTasks.sort((a: any, b: any) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());
                setTasks(activeTasks);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const getUrgencyClass = (endDate: string) => {
        const hours = differenceInHours(new Date(endDate), new Date());
        if (hours < 0) return styles.danger; // Overdue
        if (hours <= 24) return styles.warning; // Due soon
        return styles.safe; // Plenty of time
    };

    if (!session?.user || tasks.length === 0) return null;

    const currentUserId = (session.user as any).id;

    return (
        <>
            <div className={styles.taskBar}>
                <div className={styles.label}>
                    <Clock size={14} /> My Tasks
                </div>
                <div className={styles.chipContainer}>
                    {tasks.map(task => {
                        const isReview = task.status === 'in_review' && task.creatorId === currentUserId;
                        const urgencyClass = isReview ? styles.review : getUrgencyClass(task.endDate);

                        return (
                            <button
                                key={task.id}
                                className={`${styles.chip} ${urgencyClass}`}
                                onClick={() => setSelectedTask(task)}
                            >
                                {isReview && <AlertCircle size={12} className={styles.icon} />}
                                <span className={styles.taskTitle}>{task.title}</span>
                                {!isReview && (
                                    <span className={styles.timeLabel}>
                                        {differenceInHours(new Date(task.endDate), new Date()) < 0
                                            ? 'Overdue'
                                            : `${differenceInDays(new Date(task.endDate), new Date())}d`}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {selectedTask && (
                <TaskDetailModal
                    task={selectedTask}
                    currentUserId={currentUserId}
                    onClose={() => setSelectedTask(null)}
                    onUpdate={(updatedTask) => {
                        fetchTasks(); // Refresh list on update
                    }}
                />
            )}
        </>
    );
}
