'use client';

import type { Editor } from '@tiptap/react';
import {
    Bold, Italic, Underline, Strikethrough, Code,
    Link, AlignLeft, AlignCenter, AlignRight,
    List, ListOrdered, Quote, Minus
} from 'lucide-react';

interface Props {
    editor: Editor;
}

export default function EditorToolbar({ editor }: Props) {
    if (!editor) return null;

    const ToolbarButton = ({
        onClick,
        isActive = false,
        children,
        title,
    }: {
        onClick: () => void;
        isActive?: boolean;
        children: React.ReactNode;
        title: string;
    }) => (
        <button
            className={`floating-toolbar-btn ${isActive ? 'is-active' : ''}`}
            onClick={onClick}
            title={title}
            type="button"
        >
            {children}
        </button>
    );

    const setLink = () => {
        const url = window.prompt('Enter URL:');
        if (url) {
            editor.chain().focus().setLink({ href: url }).run();
        }
    };

    return (
        <div className="floating-toolbar">
            {/* Text type selector */}
            <select
                className="floating-toolbar-select"
                value={
                    editor.isActive('heading', { level: 1 }) ? 'h1'
                        : editor.isActive('heading', { level: 2 }) ? 'h2'
                            : editor.isActive('heading', { level: 3 }) ? 'h3'
                                : 'p'
                }
                onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'p') editor.chain().focus().setParagraph().run();
                    else if (val === 'h1') editor.chain().focus().toggleHeading({ level: 1 }).run();
                    else if (val === 'h2') editor.chain().focus().toggleHeading({ level: 2 }).run();
                    else if (val === 'h3') editor.chain().focus().toggleHeading({ level: 3 }).run();
                }}
            >
                <option value="p">Text</option>
                <option value="h1">Heading 1</option>
                <option value="h2">Heading 2</option>
                <option value="h3">Heading 3</option>
            </select>

            <div className="floating-toolbar-divider" />

            {/* Inline formatting */}
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleBold().run()}
                isActive={editor.isActive('bold')}
                title="Bold (Ctrl+B)"
            >
                <Bold size={15} />
            </ToolbarButton>

            <ToolbarButton
                onClick={() => editor.chain().focus().toggleItalic().run()}
                isActive={editor.isActive('italic')}
                title="Italic (Ctrl+I)"
            >
                <Italic size={15} />
            </ToolbarButton>

            <ToolbarButton
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                isActive={editor.isActive('underline')}
                title="Underline (Ctrl+U)"
            >
                <Underline size={15} />
            </ToolbarButton>

            <ToolbarButton
                onClick={() => editor.chain().focus().toggleStrike().run()}
                isActive={editor.isActive('strike')}
                title="Strikethrough"
            >
                <Strikethrough size={15} />
            </ToolbarButton>

            <ToolbarButton
                onClick={() => editor.chain().focus().toggleCode().run()}
                isActive={editor.isActive('code')}
                title="Inline code"
            >
                <Code size={15} />
            </ToolbarButton>

            <div className="floating-toolbar-divider" />

            {/* Link */}
            <ToolbarButton
                onClick={setLink}
                isActive={editor.isActive('link')}
                title="Link"
            >
                <Link size={15} />
            </ToolbarButton>

            <div className="floating-toolbar-divider" />

            {/* Alignment */}
            <ToolbarButton
                onClick={() => editor.chain().focus().setTextAlign('left').run()}
                isActive={editor.isActive({ textAlign: 'left' })}
                title="Align left"
            >
                <AlignLeft size={15} />
            </ToolbarButton>

            <ToolbarButton
                onClick={() => editor.chain().focus().setTextAlign('center').run()}
                isActive={editor.isActive({ textAlign: 'center' })}
                title="Align center"
            >
                <AlignCenter size={15} />
            </ToolbarButton>

            <ToolbarButton
                onClick={() => editor.chain().focus().setTextAlign('right').run()}
                isActive={editor.isActive({ textAlign: 'right' })}
                title="Align right"
            >
                <AlignRight size={15} />
            </ToolbarButton>

            <div className="floating-toolbar-divider" />

            {/* Block types */}
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                isActive={editor.isActive('bulletList')}
                title="Bullet list"
            >
                <List size={15} />
            </ToolbarButton>

            <ToolbarButton
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                isActive={editor.isActive('orderedList')}
                title="Numbered list"
            >
                <ListOrdered size={15} />
            </ToolbarButton>

            <ToolbarButton
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                isActive={editor.isActive('blockquote')}
                title="Quote"
            >
                <Quote size={15} />
            </ToolbarButton>

            <ToolbarButton
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
                title="Divider"
            >
                <Minus size={15} />
            </ToolbarButton>
        </div>
    );
}
