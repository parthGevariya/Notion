import { X } from 'lucide-react';
import styles from './PopupPreview.module.css';
import BlockEditor from '../Editor/BlockEditor';

interface PopupPreviewProps {
    type: 'script' | 'caption' | 'thumbnail';
    content: any;
    onClose: () => void;
}

export default function PopupPreview({ type, content, onClose }: PopupPreviewProps) {
    if (!content) return null;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2>
                        {type === 'script' ? `Script: ${content.title || 'Untitled'}` :
                            type === 'caption' ? 'Caption' : 'Thumbnail'}
                    </h2>
                    <button className={styles.closeBtn} onClick={onClose}><X size={18} /></button>
                </div>

                <div className={styles.body}>
                    {type === 'script' && (
                        <div className={styles.scriptContent}>
                            {content.content ? (
                                <BlockEditor
                                    content={content.content}
                                    onChange={() => { }} // Read-only view in popup
                                    onCreateDatabase={() => { }}
                                    onCreateScriptPanel={() => { }}
                                />
                            ) : (
                                <p className={styles.empty}>This script is currently empty.</p>
                            )}
                        </div>
                    )}

                    {type === 'caption' && (
                        <div className={styles.captionContent}>
                            {content}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
