'use client';
/**
 * TipTapScriptEditor
 * Lightweight TipTap editor for the unified script document.
 * - H1 headings get DOM id="script-h1-{slug}" for scroll-to anchoring.
 * - Listens for 'script-add-section' window event to insert a new H1 at end.
 * - Supports readOnly prop.
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
import Heading from '@tiptap/extension-heading';
import { useEffect, useRef, useState, useCallback } from 'react';
import EditorToolbar from '@/components/Editor/EditorToolbar';
import { SlashCommandMenu } from '@/components/Editor/SlashCommandMenu';
import '@/components/Editor/editor.css';

export interface TipTapScriptEditorProps {
    scriptId: string;
    initialContent: string | null;
    onChange: (content: string) => void;
    onBlur?: () => void;
    readOnly?: boolean;
    onFocus?: () => void;
    onKeystroke?: () => void; // fires on every raw edit (before 600ms onChange debounce)
}

function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export default function TipTapScriptEditor({ scriptId, initialContent,
    onChange,
    onBlur,
    onFocus,
    onKeystroke,
    readOnly = false,
}: TipTapScriptEditorProps) {
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
            StarterKit.configure({
                heading: false, // We override with custom heading below
                codeBlock: false,
            }),
            // Custom Heading extension: adds id="script-h1-{slug}" to H1 nodes
            Heading.configure({ levels: [1, 2, 3] }).extend({
                addAttributes() {
                    return {
                        ...this.parent?.(),
                        id: {
                            default: null,
                            renderHTML: (attributes) => {
                                if (!attributes.id) return {};
                                return { id: attributes.id };
                            },
                            parseHTML: (element) => element.getAttribute('id'),
                        },
                    };
                },
            }),
            Placeholder.configure({
                placeholder: "Write your script here… Use H1 headings to separate each script. Use '/' for formatting.",
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
            attributes: { class: 'ProseMirror script-editor-prose script-doc-prose' },
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

            // Assign id attributes to H1 nodes for scroll anchoring
            const { tr } = ed.state;
            let modified = false;
            ed.state.doc.descendants((node, pos) => {
                if (node.type.name === 'heading' && node.attrs.level === 1) {
                    const text = node.textContent.trim();
                    const id = `script-h1-${slugify(text)}`;
                    if (node.attrs.id !== id) {
                        tr.setNodeMarkup(pos, undefined, { ...node.attrs, id });
                        modified = true;
                    }
                }
            });
            if (modified) {
                ed.view.dispatch(tr);
                return;
            }

            onKeystroke?.(); // fire immediately (before debounce) so parent knows user is actively typing

            if (saveTimer.current) clearTimeout(saveTimer.current);
            saveTimer.current = setTimeout(() => {
                onChange(JSON.stringify(ed.getJSON()));
            }, 600);
        },
        onBlur: () => {
            onBlur?.();
        },
        onFocus: () => {
            onFocus?.();
        },
    });

    // Sync editable when read-only changes
    useEffect(() => {
        editor?.setEditable(!readOnly);
    }, [editor, readOnly]);

    // Reset content if scriptId changes
    useEffect(() => {
        if (!editor) return;
        const parsed = parseContent(initialContent);
        if (parsed && JSON.stringify(editor.getJSON()) !== JSON.stringify(parsed)) {
            editor.commands.setContent(parsed);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scriptId]);

    // Listen for 'script-add-section' — insert new H1 at end of document
    useEffect(() => {
        if (!editor) return;
        const handler = () => {
            editor.chain().focus().command(({ tr, state, dispatch }) => {
                if (!dispatch) return false;
                const end = state.doc.content.size;
                const headingType = state.schema.nodes.heading;
                const paraType = state.schema.nodes.paragraph;
                const newH1 = headingType.create({ level: 1 });
                const newPara = paraType.create();
                const fragment = state.schema.topNodeType.schema.nodes.doc
                    ? [newH1, newPara]
                    : [newH1, newPara];
                tr.insert(end, fragment);
                tr.setSelection(
                    tr.doc.resolve(end + 1) ? 
                        (tr.doc.resolve(end + 1) as unknown as import('prosemirror-state').Selection) : 
                        state.selection
                );
                dispatch(tr);
                return true;
            }).run();
            // Scroll to bottom after insertion
            setTimeout(() => {
                const el = wrapperRef.current;
                if (el) {
                    const scrollable = el.closest('[class*="editorScrollArea"]') as HTMLElement;
                    if (scrollable) scrollable.scrollTop = scrollable.scrollHeight;
                }
            }, 100);
        };
        window.addEventListener('script-add-section', handler);
        return () => window.removeEventListener('script-add-section', handler);
    }, [editor]);

    // Close slash menu on click outside
    useEffect(() => {
        if (!slashPos) return;
        const handleClick = () => setSlashPos(null);
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, [slashPos]);

    const handleSlashCommand = useCallback((command: string) => {
        if (!editor) return;
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
        <div ref={wrapperRef} style={{ position: 'relative', minHeight: 400 }}>
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
