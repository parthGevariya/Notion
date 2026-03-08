/**
 * google-docs.ts — Full Google Docs two-way sync
 *
 * Auth: Service account from APIs/gl-task-management-ff700e26cac4.json
 *
 * Public functions:
 *   createGoogleDoc(title)          → create doc, return docId
 *   setDocPublicRead(docId)         → make doc viewable by anyone with link
 *   syncDocumentToGoogleDoc(docId, json) → push TipTap JSON → Google Doc
 *   getDocRevisionId(docId)         → cheap metadata read, returns revisionId
 *   pullDocContent(docId)           → read Google Doc → TipTap JSON
 *   getDocUrl(docId)                → return Google Doc URL
 */

import { google, docs_v1 } from 'googleapis';
import path from 'path';
import fs from 'fs';

// ─── Auth ─────────────────────────────────────────────────────────────────────

let _auth: InstanceType<typeof google.auth.OAuth2> | null = null;

function getAuth() {
    if (_auth) return _auth;
    
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error('[google-docs] Missing Google OAuth environment variables.');
    }

    _auth = new google.auth.OAuth2(clientId, clientSecret, 'https://developers.google.com/oauthplayground');
    _auth.setCredentials({ refresh_token: refreshToken });

    return _auth;
}

async function docsClient() {
    return google.docs({ version: 'v1', auth: getAuth() });
}

async function driveClient() {
    return google.drive({ version: 'v3', auth: getAuth() });
}

// ─── TipTap → Google Docs conversion ─────────────────────────────────────────

type TipTapNode = {
    type: string;
    content?: TipTapNode[];
    text?: string;
    marks?: { type: string }[];
    attrs?: { level?: number; href?: string; src?: string };
};

function extractText(node: TipTapNode): string {
    if (node.text) return node.text;
    return (node.content || []).map(extractText).join('');
}

function buildDocRequests(tipTapJson: TipTapNode): docs_v1.Schema$Request[] {
    const requests: docs_v1.Schema$Request[] = [];
    // cursor starts at 1 (Google Docs always has a newline at position 0)
    let cursor = 1;
    const nodes = tipTapJson?.content || [];

    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const text = extractText(node);
        // Every block ends with \n to act as a paragraph separator
        const lineText = text + '\n';

        requests.push({ insertText: { location: { index: cursor }, text: lineText } });

        // Paragraph / heading style
        let namedStyle: string = 'NORMAL_TEXT';
        if (node.type === 'heading') {
            const lvl = node.attrs?.level ?? 1;
            namedStyle = lvl === 1 ? 'HEADING_1' : lvl === 2 ? 'HEADING_2' : 'HEADING_3';
        }

        // The range is the text only (not the trailing \n which belongs to the NEXT paragraph)
        const textLen = lineText.length;
        requests.push({
            updateParagraphStyle: {
                range: { startIndex: cursor, endIndex: cursor + textLen - 1 },
                paragraphStyle: { namedStyleType: namedStyle },
                fields: 'namedStyleType',
            },
        });

        if (node.type === 'horizontalRule') {
            cursor += textLen;
            continue;
        }

        // Inline formatting
        let inlineCursor = cursor;
        for (const inline of (node.content || [])) {
            const inlineText = inline.text || '';
            if (!inlineText) continue;
            const marks = (inline.marks || []).map((m) => m.type);
            const bold = marks.includes('bold');
            const italic = marks.includes('italic');
            const underline = marks.includes('underline');
            if (bold || italic || underline) {
                requests.push({
                    updateTextStyle: {
                        range: { startIndex: inlineCursor, endIndex: inlineCursor + inlineText.length },
                        textStyle: { bold, italic, underline },
                        fields: 'bold,italic,underline',
                    },
                });
            }
            inlineCursor += inlineText.length;
        }

        cursor += textLen;
    }

    return requests;
}

// ─── Google Docs → TipTap conversion ─────────────────────────────────────────

function gdocElementToTipTap(element: docs_v1.Schema$StructuralElement): TipTapNode | null {
    const para = element.paragraph;
    if (!para) return null;

    const namedStyle = para.paragraphStyle?.namedStyleType || 'NORMAL_TEXT';
    const level =
        namedStyle === 'HEADING_1' ? 1 :
        namedStyle === 'HEADING_2' ? 2 :
        namedStyle === 'HEADING_3' ? 3 : 0;

    const inlineNodes: TipTapNode[] = (para.elements || [])
        .filter(e => e.textRun && e.textRun.content !== '\n')
        .map(e => {
            const run = e.textRun!;
            const text = (run.content || '').replace(/\n$/, ''); // strip trailing \n from the text run (paragraph boundary char)
            const marks: { type: string }[] = [];
            const ts = run.textStyle;
            if (ts?.bold) marks.push({ type: 'bold' });
            if (ts?.italic) marks.push({ type: 'italic' });
            if (ts?.underline) marks.push({ type: 'underline' });
            return { type: 'text', text, ...(marks.length ? { marks } : {}) };
        });

    if (!inlineNodes.length) return null;

    if (level > 0) {
        return { type: 'heading', attrs: { level }, content: inlineNodes };
    }
    return { type: 'paragraph', content: inlineNodes };
}

// ─── Public API ───────────────────────────────────────────────────────────────

// The ID of the "Scripts" subfolder inside the company's Shared Folder
const SCRIPTS_FOLDER_ID = '1zer4MuB3A8HM0pBJQC11E_uJqIyc6QpF';

/**
 * Create a new Google Doc inside the company's Shared Folder.
 * We must use the Drive API for creation (not Docs API) to specify the parent folder.
 */
export async function createGoogleDoc(title: string): Promise<string> {
    const drive = await driveClient();
    
    // Create a Google Doc (mimeType application/vnd.google-apps.document) inside the target folder
    const res = await drive.files.create({
        requestBody: {
            name: title,
            mimeType: 'application/vnd.google-apps.document',
            parents: [SCRIPTS_FOLDER_ID]
        }
    });
    
    const docId = res.data.id!;
    console.log(`[google-docs] ✅ Created inside Shared Folder: ${docId}`);
    return docId;
}

/**
 * Make a Google Doc publicly viewable by anyone with the link.
 * Note: We no longer need to explicitly share with taskmanagementgl@gmail.com
 * because the doc inherits Editor permissions from the parent Shared Folder.
 */
export async function setDocPublicRead(docId: string): Promise<void> {
    const drive = await driveClient();

    // Make it publicly readable (so anyone with the link can view in the app iframe/link)
    await drive.permissions.create({
        fileId: docId,
        requestBody: { role: 'writer', type: 'anyone' },
    });
    
    console.log(`[google-docs] ✅ Set public write: ${docId}`);
}

/**
 * Get the revisionId and modifiedTime of a Google Doc — very cheap metadata read.
 * Returns null if the doc doesn't exist (404).
 */
export async function getDocRevisionId(docId: string): Promise<{ revisionId: string | null; modifiedTime: string; version: string } | null> {
    try {
        const drive = await driveClient();
        const res = await drive.files.get({ fileId: docId, fields: 'headRevisionId,modifiedTime,version' });
        if (!res.data.modifiedTime) return null;
        return {
            revisionId: res.data.headRevisionId || null,
            modifiedTime: res.data.modifiedTime,
            version: String(res.data.version || ''),
        };
    } catch (err: unknown) {
        const e = err as { code?: number };
        if (e?.code === 404) return null;
        throw err;
    }
}

/**
 * Push TipTap JSON document to an existing Google Doc.
 * Auto-handles 404 by returning false (caller should recreate).
 */
export async function syncDocumentToGoogleDoc(docId: string, tipTapJson: TipTapNode): Promise<boolean> {
    try {
        const docs = await docsClient();

        // Step 1: Get current doc length to clear it
        const current = await docs.documents.get({ documentId: docId });
        const bodyContent = current.data.body?.content || [];
        const lastEl = bodyContent[bodyContent.length - 1];
        const endIndex = (lastEl?.endIndex ?? 2) - 1;

        if (endIndex > 1) {
            await docs.documents.batchUpdate({
                documentId: docId,
                requestBody: { requests: [{ deleteContentRange: { range: { startIndex: 1, endIndex } } }] },
            });
        }

        // Step 2: Build a single full-text string and a list of ranges for styles
        const nodes = tipTapJson?.content || [];
        if (nodes.length === 0) return true;

        type StyleRange = { start: number; end: number; namedStyle: string; inlineStyles: { start: number; end: number; bold?: boolean; italic?: boolean; underline?: boolean; }[] };
        const styleRanges: StyleRange[] = [];

        let fullText = '';
        for (const node of nodes) {
            const text = extractText(node);
            const blockStart = 1 + fullText.length; // 1-indexed Google Docs position
            const blockText = text + '\n';
            fullText += blockText;
            const blockEnd = 1 + fullText.length - 1; // position of the \n

            let namedStyle = 'NORMAL_TEXT';
            if (node.type === 'heading') {
                const lvl = node.attrs?.level ?? 1;
                namedStyle = lvl === 1 ? 'HEADING_1' : lvl === 2 ? 'HEADING_2' : 'HEADING_3';
            }

            const inlineStyles: StyleRange['inlineStyles'] = [];
            let inlineCursor = blockStart;
            for (const inline of (node.content || [])) {
                const inlineText = inline.text || '';
                if (!inlineText) continue;
                const marks = (inline.marks || []).map((m) => m.type);
                const bold = marks.includes('bold');
                const italic = marks.includes('italic');
                const underline = marks.includes('underline');
                if (bold || italic || underline) {
                    inlineStyles.push({ start: inlineCursor, end: inlineCursor + inlineText.length, bold, italic, underline });
                }
                inlineCursor += inlineText.length;
            }

            styleRanges.push({ start: blockStart, end: blockEnd, namedStyle, inlineStyles });
        }

        // Step 3: Insert all text in a single request (one string, one position)
        const styleRequests: docs_v1.Schema$Request[] = [];
        styleRequests.push({ insertText: { location: { index: 1 }, text: fullText } });

        // Step 4: Apply paragraph styles and inline formatting
        for (const r of styleRanges) {
            styleRequests.push({
                updateParagraphStyle: {
                    range: { startIndex: r.start, endIndex: r.end },
                    paragraphStyle: { namedStyleType: r.namedStyle },
                    fields: 'namedStyleType',
                },
            });
            for (const il of r.inlineStyles) {
                styleRequests.push({
                    updateTextStyle: {
                        range: { startIndex: il.start, endIndex: il.end },
                        textStyle: { bold: il.bold, italic: il.italic, underline: il.underline },
                        fields: 'bold,italic,underline',
                    },
                });
            }
        }

        await docs.documents.batchUpdate({ documentId: docId, requestBody: { requests: styleRequests } });

        console.log(`[google-docs] ✅ Pushed to: ${docId}`);
        return true;
    } catch (err: unknown) {
        const e = err as { code?: number };
        if (e?.code === 404) return false;
        throw err;
    }
}

/**
 * Pull Google Doc content and convert to TipTap JSON.
 * Returns null if doc doesn't exist.
 */
export async function pullDocContent(docId: string): Promise<TipTapNode | null> {
    try {
        const docs = await docsClient();
        const res = await docs.documents.get({ documentId: docId });
        const elements = res.data.body?.content || [];

        const nodes = elements
            .map(gdocElementToTipTap)
            .filter((n): n is TipTapNode => n !== null);

        return { type: 'doc', content: nodes };
    } catch (err: unknown) {
        const e = err as { code?: number };
        if (e?.code === 404) return null;
        throw err;
    }
}

/**
 * Get the Google Docs edit URL.
 */
export function getDocUrl(docId: string): string {
    return `https://docs.google.com/document/d/${docId}/edit`;
}
