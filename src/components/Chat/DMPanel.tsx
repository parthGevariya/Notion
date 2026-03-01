'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, ImageIcon, X } from 'lucide-react';
import { Socket } from 'socket.io-client';
import MessageBubble from './MessageBubble';
import styles from './ChatPanels.module.css';

interface DMPanelProps {
    socket: Socket;
    receiverId: string;
    userId: string;
    userName: string;
    isActive: boolean;
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

export default function DMPanel({ socket, receiverId, userId, userName, isActive }: DMPanelProps) {
    const [messages, setMessages] = useState<any[]>([]);
    const [input, setInput] = useState('');
    const [imagePreview, setImagePreview] = useState<{ file: File; previewUrl: string } | null>(null);
    const [uploading, setUploading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = useCallback(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, []);

    useEffect(() => {
        if (!receiverId) return;
        fetch(`/api/chat/dm/${receiverId}`)
            .then(res => res.ok ? res.json() : [])
            .then(data => { setMessages(data); setTimeout(scrollToBottom, 100); })
            .catch(console.error);
    }, [receiverId, scrollToBottom]);

    useEffect(() => {
        const handleNewMessage = (msg: any) => {
            if (msg.senderId === receiverId || msg.receiverId === receiverId) {
                setMessages(prev => {
                    if (prev.find(m => m.id === msg.id)) return prev;
                    return [...prev, msg];
                });
                setTimeout(scrollToBottom, 50);
            }
        };
        socket.on('new-dm', handleNewMessage);
        return () => { socket.off('new-dm', handleNewMessage); };
    }, [socket, receiverId, scrollToBottom]);

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

    const handleSend = async () => {
        const hasText = input.trim().length > 0;
        const hasImage = imagePreview !== null;
        if ((!hasText && !hasImage) || !receiverId) return;

        const content = input.trim();
        setInput('');
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
            senderId: userId,
            receiverId,
            sender: { id: userId, name: userName, role: '' },
            createdAt: new Date().toISOString(),
        };
        setMessages(prev => [...prev, tempMsg]);
        setTimeout(scrollToBottom, 50);

        const res = await fetch(`/api/chat/dm/${receiverId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: content || null, mediaUrl }),
        });

        if (res.ok) {
            const realMsg = await res.json();
            setMessages(prev => prev.map(m => m.id === tempMsg.id ? realMsg : m));
            socket.emit('send-dm', { receiverId, message: realMsg });
        } else {
            setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.messageList} ref={scrollRef}>
                {messages.length === 0 ? (
                    <div className={styles.empty}>Send a message to start chatting!</div>
                ) : (
                    messages.map(msg => (
                        <MessageBubble key={msg.id} message={msg} isOwn={msg.senderId === userId} />
                    ))
                )}
            </div>

            {/* Image preview bar */}
            {imagePreview && (
                <div className={styles.imagePreviewBar}>
                    <img src={imagePreview.previewUrl} alt="preview" className={styles.imagePreviewThumb} />
                    <span className={styles.imagePreviewName}>{imagePreview.file.name}</span>
                    <button className={styles.removeImageBtn} onClick={clearImagePreview}>
                        <X size={14} />
                    </button>
                </div>
            )}

            <div className={styles.inputArea}>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                />
                <button
                    className={styles.imageBtn}
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach image"
                >
                    <ImageIcon size={18} />
                </button>
                <input
                    type="text"
                    className={styles.input}
                    placeholder="Type a message..."
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onPaste={handlePaste}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSend(); } }}
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
