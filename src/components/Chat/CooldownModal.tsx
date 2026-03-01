import { useState } from 'react';
import { X, Clock, AlertTriangle } from 'lucide-react';
import styles from './CooldownModal.module.css';

interface CooldownModalProps {
    targetUserId: string;
    targetUserName: string;
    onClose: () => void;
    onSuccess: () => void;
}

export default function CooldownModal({ targetUserId, targetUserName, onClose, onSuccess }: CooldownModalProps) {
    const [minutes, setMinutes] = useState(5);
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleApply = async () => {
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/chat/cooldown', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: targetUserId, minutes, reason })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to apply cooldown');
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <div className={styles.title}>
                        <AlertTriangle size={18} className={styles.warningIcon} />
                        Mute User
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>

                <div className={styles.body}>
                    <p className={styles.description}>
                        Temporarily restrict <strong>{targetUserName}</strong> from sending messages in group chats and DMs.
                    </p>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>
                            <Clock size={14} /> Duration
                        </label>
                        <div className={styles.durationOptions}>
                            {[5, 15, 60, 1440].map(mins => (
                                <button
                                    key={mins}
                                    className={`${styles.durationBtn} ${minutes === mins ? styles.active : ''}`}
                                    onClick={() => setMinutes(mins)}
                                >
                                    {mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Reason (Optional)</label>
                        <input
                            type="text"
                            className={styles.input}
                            placeholder="e.g., Spamming, inappropriate language"
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            maxLength={100}
                        />
                    </div>

                    {error && <div className={styles.error}>{error}</div>}
                </div>

                <div className={styles.footer}>
                    <button className={styles.cancelBtn} onClick={onClose} disabled={loading}>
                        Cancel
                    </button>
                    <button className={styles.applyBtn} onClick={handleApply} disabled={loading}>
                        {loading ? 'Applying...' : `Mute for ${minutes >= 60 ? `${minutes / 60}h` : `${minutes}m`}`}
                    </button>
                </div>
            </div>
        </div>
    );
}
