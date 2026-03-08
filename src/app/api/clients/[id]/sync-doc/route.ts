/**
 * /api/clients/[id]/sync-doc
 *
 * GET  → Return revisionId + docUrl + lastSyncedAt (cheap poll endpoint)
 * POST → Push our TipTap content to Google Doc (auto-recreate on 404)
 * PUT  → Pull Google Doc content → update our DB → return new TipTap JSON
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
    syncDocumentToGoogleDoc,
    createGoogleDoc,
    setDocPublicRead,
    getDocRevisionId,
    pullDocContent,
    getDocUrl,
} from '@/lib/google-docs';

type Params = { params: Promise<{ id: string }> };

// ─── Server-side Drive metadata cache (3s TTL) ────────────────────────────────
// TTL must be SHORTER than the poll interval (5s) so every poll always fetches
// fresh data. 3s TTL + 5s interval = cache guaranteed expired at every tick.
// Reduces Drive API load when multiple users poll within the same 3s window.
type CachedDocMeta = { revisionId: string | null; modifiedTime: string; version: string; fetchedAt: number };
const docMetaCache = new Map<string, CachedDocMeta>();
const CACHE_TTL_MS = 3_000; // 3s < 5s interval — see above

function getCache(docId: string): CachedDocMeta | null {
    const e = docMetaCache.get(docId);
    if (e && Date.now() - e.fetchedAt < CACHE_TTL_MS) return e;
    docMetaCache.delete(docId);
    return null;
}
function setCache(docId: string, data: { revisionId: string | null; modifiedTime: string; version: string }) {
    docMetaCache.set(docId, { ...data, fetchedAt: Date.now() });
}
export function bustCache(docId: string) { docMetaCache.delete(docId); }

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getClientAndScript(clientId: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = await (prisma as any).client.findUnique({ where: { id: clientId } });
    if (!client) return { client: null, page: null, masterScript: null };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const page = await (prisma as any).page.findFirst({
        where: { clientId, pageType: 'script_page' },
    });
    if (!page) return { client, page: null, masterScript: null };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const masterScript = await (prisma as any).script.findFirst({
        where: { pageId: page.id },
        orderBy: { createdAt: 'asc' },
    });

    return { client, page, masterScript };
}

async function ensureDocExists(client: { id: string; name?: string; googleDocId?: string | null }): Promise<string> {
    if (client.googleDocId) return client.googleDocId;

    const docId = await createGoogleDoc(`${client.name || 'Client'} — Scripts`);
    await setDocPublicRead(docId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).client.update({
        where: { id: client.id },
        data: { googleDocId: docId },
    });
    return docId;
}

// ─── GET — poll: return modifiedTime + lastSyncedAt ───────────────────────────

export async function GET(_req: NextRequest, { params }: Params) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: clientId } = await params;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = await (prisma as any).client.findUnique({ where: { id: clientId } });
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

    if (!client.googleDocId) {
        return NextResponse.json({ revisionId: null, docUrl: null, lastSyncedAt: null });
    }

    // Use 3s cache to reduce Drive API calls during multi-user burst polling
    let docData = getCache(client.googleDocId);
    if (!docData) {
        const fresh = await getDocRevisionId(client.googleDocId);
        if (fresh) { setCache(client.googleDocId, fresh); docData = getCache(client.googleDocId); }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const page = await (prisma as any).page.findFirst({ where: { clientId, pageType: 'script_page' } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const script = page ? await (prisma as any).script.findFirst({ where: { pageId: page.id }, orderBy: { createdAt: 'asc' } }) : null;

    return NextResponse.json({
        revisionId: docData?.revisionId || null,
        docVersion: docData?.version || null,   // monotonic int — reliable change detector
        docModifiedAt: docData?.modifiedTime || null,
        docUrl: docData ? getDocUrl(client.googleDocId) : null,
        docId: client.googleDocId,
        lastSyncedAt: script?.lastSyncedAt ?? null,
    });
}

// ─── POST — push our content → Google Doc ─────────────────────────────────────

export async function POST(req: NextRequest, { params }: Params) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: clientId } = await params;
    const { client, masterScript } = await getClientAndScript(clientId);

    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

    // Accept content from request body OR use the saved masterScript content
    let tipTapJson: Record<string, unknown> | null = null;
    try {
        const body = await req.json().catch(() => ({}));
        if (body?.content) tipTapJson = body.content;
        else if (masterScript?.content) tipTapJson = JSON.parse(masterScript.content);
    } catch {
        tipTapJson = masterScript?.content ? JSON.parse(masterScript.content) : null;
    }

    if (!tipTapJson) {
        return NextResponse.json({ message: 'No content to sync yet.' });
    }

    let docId = await ensureDocExists(client);

    // Push — if 404 (doc was deleted), recreate and push again
    let pushed = false;
    try {
        console.log(`[sync-doc] Attempting to push TipTap JSON to Doc: ${docId}`);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pushed = await syncDocumentToGoogleDoc(docId, tipTapJson as any);
        console.log(`[sync-doc] Push result: ${pushed}`);
    } catch (pushErr) {
        console.error(`[sync-doc] ❌ CRITICAL ERROR IN syncDocumentToGoogleDoc:`, pushErr);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((pushErr as any)?.code === 404) {
             pushed = false;
        } else {
             return NextResponse.json({ error: 'Sync Failed', details: (pushErr as Error).message }, { status: 500 });
        }
    }

    if (!pushed) {
        // Doc was deleted externally — recreate
        console.log(`[sync-doc] Doc 404 or missing, recreating...`);
        docId = await createGoogleDoc(`${client.name || 'Client'} — Scripts`);
        await setDocPublicRead(docId);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (prisma as any).client.update({ where: { id: clientId }, data: { googleDocId: docId } });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        console.log(`[sync-doc] Re-attempting push to new Doc: ${docId}`);
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            pushed = await syncDocumentToGoogleDoc(docId, tipTapJson as any);
        } catch (recreateErr) {
            console.error(`[sync-doc] ❌ CRITICAL ERROR ON RECREATE PUSH:`, recreateErr);
            return NextResponse.json({ error: 'Sync Failed on Recreate', details: (recreateErr as Error).message }, { status: 500 });
        }
    }

    const docData = await getDocRevisionId(docId);

    // Update lastSyncedAt on the masterScript
    if (masterScript) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (prisma as any).script.update({
            where: { id: masterScript.id },
            data: { lastSyncedAt: docData?.modifiedTime ? new Date(docData.modifiedTime) : new Date() },
        });
    }
    bustCache(docId); // force fresh Drive data on next poll

    return NextResponse.json({
        message: pushed ? '✅ Synced to Google Docs!' : '⚠️ Sync attempted but may have failed.',
        docId,
        docUrl: getDocUrl(docId),
        revisionId: docData?.revisionId || null,
        docVersion: docData?.version || null,
        recreated: !pushed,
    });
}

// ─── PUT — pull Google Doc → update our DB ────────────────────────────────────

export async function PUT(_req: NextRequest, { params }: Params) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: clientId } = await params;
    const { client, masterScript } = await getClientAndScript(clientId);

    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    if (!client.googleDocId) return NextResponse.json({ error: 'No Google Doc linked yet' }, { status: 404 });

    const tipTapJson = await pullDocContent(client.googleDocId);
    if (!tipTapJson) {
        return NextResponse.json({ error: 'Google Doc not found or empty' }, { status: 404 });
    }

    const contentStr = JSON.stringify(tipTapJson);

    const docData = await getDocRevisionId(client.googleDocId);

    if (masterScript) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (prisma as any).script.update({
            where: { id: masterScript.id },
            data: { content: contentStr, lastSyncedAt: docData?.modifiedTime ? new Date(docData.modifiedTime) : new Date() },
        });
    }
    bustCache(client.googleDocId); // force fresh Drive data on next poll

    return NextResponse.json({
        message: '✅ Pulled from Google Docs.',
        content: contentStr,
        revisionId: docData?.revisionId || null,
    });
}
