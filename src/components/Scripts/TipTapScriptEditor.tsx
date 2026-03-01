'use client';
/**
 * TipTapScriptEditor
 * Lightweight TipTap editor for a single script's content.
 * Uses the same extensions as BlockEditor.
 * Supports readOnly prop (when another user holds the block-lock).
 */
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import { useEffect, useRef, useState, useCallback } from 'react';
import EditorToolbar from '@/components/Editor/EditorToolbar';
import { SlashCommandMenu } from '@/components/Editor/SlashCommandMenu';
import '@/components/Editor/editor.css';

export interface TipTapScriptEditorProps {
    scriptId: string;
    initialContent: string | null;
    onChange: (content: string) => void;
    readOnly?: boolean;
}

export default function TipTapScriptEditor({ scriptId, initialContent, onChange, readOnly = false }: TipTapScriptEditorProps) {
    const saveTimer = useRef<NodeJS.Timeout | undefined>(undefined);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [slashPos, setSlashPos] = useState<{ top: number; left: number } | null>(null);

    // Parse content: may be JSON (TipTap format) or plain text
    const parseContent = (raw: string | null) => {
        if (!raw) return undefined;
        try { return JSON.parse(raw); } catch { return raw; }
    };

    const editor = useEditor({
        immediatelyRender: true,
        extensions: [
            StarterKit.configure({ heading: { levels: [1, 2, 3] }, codeBlock: false }),
            Placeholder.configure({
                placeholder: "Write your script here... Use '/' for formatting",
            }),
            TaskList,
            TaskItem.configure({ nested: true }),
            Underline,
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
            }),
        ],
        content: parseContent(initialContent),
        editable: !readOnly,
        editorProps: {
            attributes: { class: 'ProseMirror script-editor-prose' },
            handleKeyDown: (view, event) => {
                if (event.key === '/' && !event.ctrlKey && !event.metaKey) {
                    setTimeout(() => {
                        const { from } = view.state.selection;
                        const coords = view.coordsAtPos(from);
                        const rect = wrapperRef.current?.getBoundingClientRect() || { top: 0, left: 0 };

                        setSlashPos({
                            top: coords.bottom - rect.top + 4,
                            left: coords.left - rect.left,
                        });
                    }, 10);
                }

                if (event.key === 'Escape' || event.key === 'Backspace') {
                    setSlashPos(null);
                }
                return false;
            },
        },
        onUpdate: ({ editor: ed }) => {
            const { from } = ed.state.selection;
            const textBefore = ed.state.doc.textBetween(Math.max(0, from - 1), from);
            if (textBefore !== '/') setSlashPos(null);

            if (saveTimer.current) clearTimeout(saveTimer.current);
            saveTimer.current = setTimeout(() => {
                onChange(JSON.stringify(ed.getJSON()));
            }, 600);
        },
    });

    // Sync editable prop when read-only status changes (e.g., another user locks/unlocks)
    useEffect(() => {
        editor?.setEditable(!readOnly);
    }, [editor, readOnly]);

    // Reset content if scriptId changes (user switches scripts)
    useEffect(() => {
        if (!editor) return;
        const parsed = parseContent(initialContent);
        // Only reset if content really changed
        if (parsed && JSON.stringify(editor.getJSON()) !== JSON.stringify(parsed)) {
            editor.commands.setContent(parsed);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scriptId]);

    // Close slash menu on click outside
    useEffect(() => {
        if (!slashPos) return;
        const handleClick = () => setSlashPos(null);
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, [slashPos]);

    const handleSlashCommand = useCallback((command: string) => {
        if (!editor) return;

        // Delete the '/' character
        const { from } = editor.state.selection;
        editor.chain().focus().deleteRange({ from: from - 1, to: from }).run();

        switch (command) {
            case 'paragraph': editor.chain().focus().setParagraph().run(); break;
            case 'h1': editor.chain().focus().toggleHeading({ level: 1 }).run(); break;
            case 'h2': editor.chain().focus().toggleHeading({ level: 2 }).run(); break;
            case 'h3': editor.chain().focus().toggleHeading({ level: 3 }).run(); break;
            case 'bulletList': editor.chain().focus().toggleBulletList().run(); break;
            case 'orderedList': editor.chain().focus().toggleOrderedList().run(); break;
            case 'taskList': editor.chain().focus().toggleTaskList().run(); break;
            case 'blockquote': editor.chain().focus().toggleBlockquote().run(); break;
            case 'divider': editor.chain().focus().setHorizontalRule().run(); break;
        }

        setSlashPos(null);
    }, [editor]);

    return (
        <div ref={wrapperRef} style={{ position: 'relative', minHeight: 200 }}>
            {editor && !readOnly && (
                <BubbleMenu editor={editor}>
                    <EditorToolbar editor={editor} />
                </BubbleMenu>
            )}
            <EditorContent editor={editor} />

            <SlashCommandMenu
                position={slashPos}
                onSelect={handleSlashCommand}
                onClose={() => setSlashPos(null)}
            />
        </div>
    );
}
