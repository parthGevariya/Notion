import { AlertTriangle } from 'lucide-react';
import styles from './ConfirmModal.module.css';

interface ConfirmModalProps {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export default function ConfirmModal({
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isDestructive = false,
    onConfirm,
    onCancel
}: ConfirmModalProps) {
    return (
        <div className={styles.overlay} onClick={onCancel}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    {isDestructive && <AlertTriangle size={24} color="#ef4444" />}
                    <h2>{title}</h2>
                </div>

                <p className={styles.message}>{message}</p>

                <div className={styles.actions}>
                    <button className={styles.cancelBtn} onClick={onCancel}>
                        {cancelText}
                    </button>
                    <button
                        className={isDestructive ? styles.destructiveBtn : styles.confirmBtn}
                        onClick={onConfirm}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
