/**
 * /api/clients — List and create clients
 * GET  → list all clients for the workspace
 * POST → create a new client (owner/manager only)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createGoogleDoc, setDocPublicRead } from '@/lib/google-docs';
import { createDriveFolder, MAIN_VIDEOS_FOLDER_ID, MAIN_THUMBNAIL_FOLDER_ID } from '@/lib/google-drive';

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const workspace = await prisma.workspace.findFirst();
        if (!workspace) return NextResponse.json([]);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const clients = await (prisma as any).client.findMany({
            where: { workspaceId: workspace.id },
            orderBy: { createdAt: 'asc' },
            include: {
                pages: {
                    where: { isTrashed: false },
                    select: { id: true, pageType: true, title: true },
                },
            },
        });

        return NextResponse.json(clients);
    } catch (e) {
        console.error('[clients GET]', e);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const role = (session.user as { role?: string }).role || 'viewer';
    if (role !== 'owner' && role !== 'manager') {
        return NextResponse.json({ error: 'Only managers and owners can create clients' }, { status: 403 });
    }

    try {
        const body = await req.json();
        const { name, emoji } = body;
        if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

        const workspace = await prisma.workspace.findFirst();
        if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

        const userId = (session.user as { id: string }).id;
        if (!userId) return NextResponse.json({ error: 'User ID missing from session' }, { status: 400 });

        // Auto-create Google Doc for the new client
        let docId: string | null = null;
        try {
            docId = await createGoogleDoc(`${name.trim()} — Scripts`);
            await setDocPublicRead(docId);
        } catch (err) {
            console.error('[clients POST] Failed to auto-create Google Doc', err);
            // We continue creating the client even if Doc creation fails (it will auto-create on first sync later)
        }

        // Auto-create Drive folders
        let videoFolderId: string | null = null;
        let thumbnailFolderId: string | null = null;
        try {
            videoFolderId = await createDriveFolder(name.trim(), MAIN_VIDEOS_FOLDER_ID);
            thumbnailFolderId = await createDriveFolder(name.trim(), MAIN_THUMBNAIL_FOLDER_ID);
        } catch (err) {
            console.error('[clients POST] Failed to auto-create Google Drive folders', err);
        }

        // Create client
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const client = await (prisma as any).client.create({
            data: {
                name: name.trim(),
                emoji: emoji || '🏢',
                workspaceId: workspace.id,
                ...(docId && { googleDocId: docId }),
                ...(videoFolderId && { videoFolderId }),
                ...(thumbnailFolderId && { thumbnailFolderId }),
            },
        });

        // Auto-create script and calendar pages
        await Promise.all([
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (prisma as any).page.create({
                data: {
                    title: `${name.trim()} — Scripts`,
                    icon: '📝',
                    workspaceId: workspace.id,
                    createdById: userId,
                    pageType: 'script_page',
                    clientId: client.id,
                },
            }),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (prisma as any).page.create({
                data: {
                    title: `${name.trim()} — Calendar`,
                    icon: '📅',
                    workspaceId: workspace.id,
                    createdById: userId,
                    pageType: 'calendar_page',
                    clientId: client.id,
                },
            }),
        ]);

        // Return the full client with its new pages for the sidebar
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fullClient = await (prisma as any).client.findUnique({
            where: { id: client.id },
            include: {
                pages: {
                    where: { isTrashed: false },
                    select: { id: true, pageType: true, title: true },
                },
            },
        });

        return NextResponse.json(fullClient, { status: 201 });
    } catch (e) {
        console.error('[clients POST]', e);
        return NextResponse.json({ error: 'Internal error: ' + String(e) }, { status: 500 });
    }
}
