'use client';

import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import styles from './PasswordConfirmModal.module.css';

interface PasswordConfirmModalProps {
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
    onCancel: () => void;
}

export default function PasswordConfirmModal({ title, message, onConfirm, onCancel }: PasswordConfirmModalProps) {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!password.trim()) { setError('Password is required'); return; }

        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/auth/verify-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
            });

            if (!res.ok) {
                const data = await res.json();
                setError(data.error || 'Incorrect password');
                setLoading(false);
                return;
            }

            await onConfirm();
        } catch {
            setError('Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.overlay} onClick={onCancel}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <div className={styles.titleRow}>
                        <AlertTriangle size={18} className={styles.warningIcon} />
                        <h3 className={styles.title}>{title}</h3>
                    </div>
                    <button className={styles.closeBtn} onClick={onCancel}>
                        <X size={16} />
                    </button>
                </div>

                <p className={styles.message}>{message}</p>

                <form onSubmit={handleSubmit} className={styles.form}>
                    <label className={styles.label}>Enter your password to confirm</label>
                    <input
                        type="password"
                        autoFocus
                        className={styles.input}
                        placeholder="Your password..."
                        value={password}
                        onChange={e => { setPassword(e.target.value); setError(''); }}
                    />
                    {error && <div className={styles.error}>{error}</div>}

                    <div className={styles.actions}>
                        <button type="button" className={styles.cancelBtn} onClick={onCancel} disabled={loading}>
                            Cancel
                        </button>
                        <button type="submit" className={styles.confirmBtn} disabled={loading || !password.trim()}>
                            {loading ? 'Verifying...' : 'Confirm Delete'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
