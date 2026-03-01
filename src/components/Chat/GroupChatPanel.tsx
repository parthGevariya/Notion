'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, ImageIcon, Trash2, X } from 'lucide-react';
import { useSession } from 'next-auth/react';
import MessageBubble from './MessageBubble';
import styles from './ChatPanels.module.css';

interface GroupChatPanelProps {
    socket: any;
    userId: string;
    userName: string;
    isActive: boolean;
}

interface User {
    id: string;
    name: string;
    avatar?: string | null;
}

// ── Client-side image compression ─────────────────────────────────────────────
async function compressImage(file: File, maxSizeMB = 1, quality = 0.7): Promise<File> {
    return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxW = 1600;
            let { width, height } = img;
            if (width > maxW) { height = Math.round((height * maxW) / width); width = maxW; }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0, width, height);
            URL.revokeObjectURL(url);
            canvas.toBlob(
                (blob) => {
                    if (!blob) { resolve(file); return; }
                    const compressed = new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
                    if (compressed.size > maxSizeMB * 1024 * 1024 && quality > 0.3) {
                        compressImage(file, maxSizeMB, quality - 0.15).then(resolve);
                    } else { resolve(compressed); }
                },
                'image/jpeg', quality
            );
        };
        img.src = url;
    });
}

async function uploadImage(file: File): Promise<string | null> {
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    if (!res.ok) return null;
    const { url } = await res.json();
    return url;
}

export default function GroupChatPanel({ socket, userId, userName, isActive }: GroupChatPanelProps) {
    const { data: session } = useSession();
    const role = (session?.user as any)?.role || 'viewer';
    const canClearChat = role === 'owner' || role === 'manager';

    const [messages, setMessages] = useState<any[]>([]);
    const [input, setInput] = useState('');
    const [imagePreview, setImagePreview] = useState<{ file: File; previewUrl: string } | null>(null);
    const [uploading, setUploading] = useState(false);
    const [users, setUsers] = useState<User[]>([]);
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionOpen, setMentionOpen] = useState(false);
    const [mentionedUsers, setMentionedUsers] = useState<User[]>([]); // Track who was @mentioned
    const [clearMenuOpen, setClearMenuOpen] = useState(false);

    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = useCallback(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, []);

    useEffect(() => {
        fetch('/api/chat/group')
            .then(res => res.ok ? res.json() : [])
            .then(data => { setMessages(data); setTimeout(scrollToBottom, 100); })
            .catch(console.error);

        fetch('/api/users')
            .then(res => res.ok ? res.json() : [])
            .then(setUsers)
            .catch(console.error);
    }, [scrollToBottom]);

    useEffect(() => {
        const handleNewMessage = (msg: any) => {
            setMessages(prev => {
                if (prev.find(m => m.id === msg.id)) return prev;
                return [...prev, msg];
            });
            setTimeout(scrollToBottom, 50);
        };
        socket.on('new-group-message', handleNewMessage);
        return () => { socket.off('new-group-message', handleNewMessage); };
    }, [socket, scrollToBottom]);

    // @mention detection
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setInput(val);

        const atIndex = val.lastIndexOf('@');
        if (atIndex >= 0) {
            const after = val.slice(atIndex + 1);
            if (!after.includes(' ') && after.length <= 20) {
                setMentionQuery(after);
                setMentionOpen(true);
                return;
            }
        }
        setMentionOpen(false);
    };

    const handleMentionSelect = (user: User) => {
        const atIndex = input.lastIndexOf('@');
        const before = input.slice(0, atIndex);
        setInput(`${before}@${user.name} `);
        setMentionOpen(false);

        // Track this user as mentioned (avoid duplicates)
        setMentionedUsers(prev => {
            if (prev.find(u => u.id === user.id)) return prev;
            return [...prev, user];
        });

        inputRef.current?.focus();
    };

    const filteredUsers = users.filter(u =>
        u.id !== userId && u.name.toLowerCase().includes(mentionQuery.toLowerCase())
    );

    // Image paste
    const handlePaste = async (e: React.ClipboardEvent) => {
        const items = Array.from(e.clipboardData.items);
        const imageItem = items.find(i => i.type.startsWith('image/'));
        if (!imageItem) return;
        e.preventDefault();
        const file = imageItem.getAsFile();
        if (!file) return;
        setImagePreview({ file, previewUrl: URL.createObjectURL(file) });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImagePreview({ file, previewUrl: URL.createObjectURL(file) });
    };

    const clearImagePreview = () => {
        if (imagePreview) URL.revokeObjectURL(imagePreview.previewUrl);
        setImagePreview(null);
    };

    // Send message with @mention user IDs
    const handleSend = async () => {
        const hasText = input.trim().length > 0;
        const hasImage = imagePreview !== null;
        if (!hasText && !hasImage) return;

        const content = input.trim();
        // Extract mentioned user IDs from current input text
        const currentMentionIds = mentionedUsers
            .filter(u => content.includes(`@${u.name}`))
            .map(u => u.id);

        setInput('');
        setMentionedUsers([]);
        setUploading(true);

        let mediaUrl: string | undefined;
        if (hasImage && imagePreview) {
            try {
                const compressed = await compressImage(imagePreview.file);
                const url = await uploadImage(compressed);
                if (url) mediaUrl = url;
            } catch (e) { console.error('Image upload failed:', e); }
            clearImagePreview();
        }
        setUploading(false);

        const tempMsg = {
            id: `temp-${Date.now()}`,
            content: content || null,
            mediaUrl: mediaUrl || null,
            mediaType: mediaUrl ? 'image' : null,
            senderId: userId,
            sender: { id: userId, name: userName, role: '' },
            createdAt: new Date().toISOString(),
        };
        setMessages(prev => [...prev, tempMsg]);
        setTimeout(scrollToBottom, 50);

        const res = await fetch('/api/chat/group', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: content || null,
                mediaUrl,
                mediaType: mediaUrl ? 'image' : undefined,
                mentionedUserIds: currentMentionIds.length > 0 ? currentMentionIds : undefined,
            }),
        });

        if (res.ok) {
            const realMsg = await res.json();
            setMessages(prev => prev.map(m => m.id === tempMsg.id ? realMsg : m));
            socket.emit('send-group-message', realMsg);
        } else {
            setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
        }
    };

    // Clear chat handler
    const handleClearChat = async (mode: 'all' | 'media') => {
        setClearMenuOpen(false);
        if (!confirm(mode === 'all' ? 'Clear all group messages? This cannot be undone.' : 'Clear all shared media from group chat?')) return;
        const res = await fetch('/api/chat/group', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode }),
        });
        if (res.ok) {
            if (mode === 'all') setMessages([]);
            else setMessages(prev => prev.map(m => ({ ...m, mediaUrl: null, mediaType: null })));
        }
    };

    return (
        <div className={styles.container}>
            {canClearChat && (
                <div className={styles.chatHeader}>
                    <span className={styles.chatHeaderTitle}>Group Chat</span>
                    <div className={styles.clearMenuWrapper}>
                        <button className={styles.clearBtn} onClick={() => setClearMenuOpen(o => !o)} title="Clear Chat Options">
                            <Trash2 size={14} />
                        </button>
                        {clearMenuOpen && (
                            <div className={styles.clearMenu}>
                                <button onClick={() => handleClearChat('all')}>Clear all messages</button>
                                <button onClick={() => handleClearChat('media')}>Clear media only</button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className={styles.messageList} ref={scrollRef}>
                {messages.length === 0 ? (
                    <div className={styles.empty}>Start the conversation! 👋</div>
                ) : (
                    messages.map(msg => (
                        <MessageBubble
                            key={msg.id}
                            message={msg}
                            isOwn={msg.senderId === userId}
                            users={users}
                            onMentionClick={(name: string) => {
                                window.dispatchEvent(new CustomEvent('open-dm-for-user', { detail: { name } }));
                            }}
                        />
                    ))
                )}
            </div>

            {/* @mention dropdown */}
            {mentionOpen && filteredUsers.length > 0 && (
                <div className={styles.mentionDropdown}>
                    {filteredUsers.map(u => (
                        <button key={u.id} className={styles.mentionItem} onMouseDown={() => handleMentionSelect(u)}>
                            <span className={styles.mentionAvatar}>{u.name[0]?.toUpperCase()}</span>
                            <span>{u.name}</span>
                        </button>
                    ))}
                </div>
            )}

            {imagePreview && (
                <div className={styles.imagePreviewBar}>
                    <img src={imagePreview.previewUrl} alt="preview" className={styles.imagePreviewThumb} />
                    <span className={styles.imagePreviewName}>{imagePreview.file.name}</span>
                    <button className={styles.removeImageBtn} onClick={clearImagePreview}><X size={14} /></button>
                </div>
            )}

            <div className={styles.inputArea}>
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
                <button className={styles.imageBtn} onClick={() => fileInputRef.current?.click()} title="Attach image">
                    <ImageIcon size={18} />
                </button>
                <input
                    ref={inputRef}
                    type="text"
                    className={styles.input}
                    placeholder="Type a message... (@ to mention)"
                    value={input}
                    onChange={handleInputChange}
                    onPaste={handlePaste}
                    onKeyDown={e => {
                        if (e.key === 'Escape') { setMentionOpen(false); return; }
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                    }}
                />
                <button
                    className={styles.sendBtn}
                    onClick={handleSend}
                    disabled={(!input.trim() && !imagePreview) || uploading}
                >
                    {uploading ? '...' : <Send size={16} />}
                </button>
            </div>
        </div>
    );
}
