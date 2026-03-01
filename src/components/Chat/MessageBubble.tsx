'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import styles from './ChatPanels.module.css';

interface MessageBubbleProps {
    message: any;
    isOwn: boolean;
    onMentionClick?: (userName: string) => void;
    users?: { id: string; name: string; role?: string }[];
}

export default function MessageBubble({ message, isOwn, onMentionClick, users = [] }: MessageBubbleProps) {
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const time = new Date(message.createdAt);
    const shortTime = format(time, 'h:mm a');

    // Render @mentions with highlighting, tooltip, and click-to-DM
    const renderContent = (text: string) => {
        if (!text) return null;
        // Split by @mention patterns (word characters including spaces until next @ or end)
        const regex = /@(\w[\w\s]*?)(?=\s@|\s*$|[.,!?])/g;
        const parts: React.ReactNode[] = [];
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(text)) !== null) {
            // Add text before the match
            if (match.index > lastIndex) {
                parts.push(text.slice(lastIndex, match.index));
            }

            const mentionName = match[1].trim();
            const matchedUser = users.find(u => u.name.toLowerCase() === mentionName.toLowerCase());
            const tooltipText = matchedUser
                ? `${matchedUser.name} • ${matchedUser.role || 'Member'}`
                : mentionName;

            parts.push(
                <span
                    key={`mention-${match.index}`}
                    className={`${styles.mentionHighlight} ${isOwn ? styles.mentionOwn : ''}`}
                    title={tooltipText}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (onMentionClick && matchedUser) {
                            onMentionClick(matchedUser.name);
                        }
                    }}
                    style={{ cursor: matchedUser ? 'pointer' : 'default' }}
                >
                    @{mentionName}
                </span>
            );

            lastIndex = match.index + match[0].length;
        }

        // Add remaining text
        if (lastIndex < text.length) {
            parts.push(text.slice(lastIndex));
        }

        return parts.length > 0 ? parts : text;
    };

    return (
        <>
            <div className={`${styles.bubbleWrapper} ${isOwn ? styles.own : ''}`}>
                {!isOwn && (
                    <div className={styles.bubbleAvatar} title={message.sender?.name}>
                        {message.sender?.name?.charAt(0).toUpperCase() || '?'}
                    </div>
                )}

                <div className={styles.bubbleContent}>
                    {!isOwn && (
                        <div className={styles.bubbleName}>
                            {message.sender?.name}
                        </div>
                    )}

                    {message.replyTo && (
                        <div className={styles.replyBox}>
                            <div className={styles.replyName}>{message.replyTo.sender?.name}</div>
                            <div className={styles.replyText}>{message.replyTo.content}</div>
                        </div>
                    )}

                    <div className={styles.bubbleBox}>
                        {/* Image rendering — click opens fullscreen lightbox */}
                        {message.mediaUrl && (
                            <img
                                src={message.mediaUrl}
                                alt="shared image"
                                className={styles.chatImage}
                                onClick={() => setLightboxOpen(true)}
                                loading="lazy"
                            />
                        )}

                        {message.content && (
                            <p className={styles.bubbleText}>
                                {renderContent(message.content)}
                            </p>
                        )}

                        <span className={styles.bubbleTime}>{shortTime}</span>
                    </div>
                </div>
            </div>

            {/* Fullscreen Lightbox Overlay */}
            {lightboxOpen && message.mediaUrl && (
                <div className={styles.lightboxOverlay} onClick={() => setLightboxOpen(false)}>
                    <img
                        src={message.mediaUrl}
                        alt="full image"
                        className={styles.lightboxImage}
                        onClick={(e) => e.stopPropagation()}
                    />
                    <button className={styles.lightboxClose} onClick={() => setLightboxOpen(false)}>
                        ✕
                    </button>
                </div>
            )}
        </>
    );
}
