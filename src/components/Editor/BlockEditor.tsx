'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SlashCommandMenu } from './SlashCommandMenu';
import EditorToolbar from './EditorToolbar';
import './editor.css';

const lowlight = createLowlight(common);

interface BlockEditorProps {
    content: string | null;
    onChange?: (content: string) => void;
    onCreateDatabase?: () => void;
    onCreateScriptPanel?: () => void;
    editable?: boolean;
}

export default function BlockEditor({ content, onChange, onCreateDatabase, onCreateScriptPanel, editable = true }: BlockEditorProps) {
    const [slashPos, setSlashPos] = useState<{ top: number; left: number } | null>(null);
    const saveTimerRef = useRef<NodeJS.Timeout>(undefined);

    const wrapperRef = useRef<HTMLDivElement>(null);

    const editor = useEditor({
        immediatelyRender: true,
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
                codeBlock: false,
            }),
            Placeholder.configure({
                placeholder: ({ node }) => {
                    if (node.type.name === 'heading') {
                        return `Heading ${node.attrs.level}`;
                    }
                    return "Press '/' for commands, or start typing...";
                },
            }),
            TaskList,
            TaskItem.configure({ nested: true }),
            Underline,
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    rel: 'noopener noreferrer',
                    target: '_blank',
                },
            }),
            CodeBlockLowlight.configure({
                lowlight,
            }),
        ],
        content: content ? JSON.parse(content) : undefined,
        editable,
        editorProps: {
            attributes: {
                class: 'ProseMirror',
            },
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
            // Close slash menu on content change
            const { from } = ed.state.selection;
            const textBefore = ed.state.doc.textBetween(Math.max(0, from - 1), from);
            if (textBefore !== '/') {
                setSlashPos(null);
            }

            // Debounced save
            if (onChange) {
                if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
                saveTimerRef.current = setTimeout(() => {
                    onChange(JSON.stringify(ed.getJSON()));
                }, 500);
            }
        },
    });

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
        editor.chain().focus()
            .deleteRange({ from: from - 1, to: from })
            .run();

        switch (command) {
            case 'paragraph':
                editor.chain().focus().setParagraph().run();
                break;
            case 'h1':
                editor.chain().focus().toggleHeading({ level: 1 }).run();
                break;
            case 'h2':
                editor.chain().focus().toggleHeading({ level: 2 }).run();
                break;
            case 'h3':
                editor.chain().focus().toggleHeading({ level: 3 }).run();
                break;
            case 'bulletList':
                editor.chain().focus().toggleBulletList().run();
                break;
            case 'orderedList':
                editor.chain().focus().toggleOrderedList().run();
                break;
            case 'taskList':
                editor.chain().focus().toggleTaskList().run();
                break;
            case 'blockquote':
                editor.chain().focus().toggleBlockquote().run();
                break;
            case 'divider':
                editor.chain().focus().setHorizontalRule().run();
                break;
            case 'codeBlock':
                editor.chain().focus().toggleCodeBlock().run();
                break;
            case 'callout':
                editor.chain().focus().toggleBlockquote().run();
                break;
            case 'inlineDatabase':
                if (onCreateDatabase) onCreateDatabase();
                break;
            case 'scriptPanel':
                if (onCreateScriptPanel) onCreateScriptPanel();
                break;
        }

        setSlashPos(null);
    }, [editor]);

    return (
        <div ref={wrapperRef} className="editor-wrapper" style={{ position: 'relative' }}>
            {/* Floating toolbar on text selection */}
            {editor && (
                <BubbleMenu editor={editor}>
                    <EditorToolbar editor={editor} />
                </BubbleMenu>
            )}

            {/* Editor content */}
            <EditorContent editor={editor} />

            {/* Slash command menu */}
            <SlashCommandMenu
                position={slashPos}
                onSelect={handleSlashCommand}
                onClose={() => setSlashPos(null)}
            />
        </div>
    );
}
