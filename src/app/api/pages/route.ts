import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { pushAppEvent } from '@/lib/pushEvent';

// GET /api/pages - List all pages for user's workspace
export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = (session.user as any).id;
        const member = await prisma.workspaceMember.findFirst({
            where: { userId },
            include: { workspace: true },
        });

        if (!member) {
            return NextResponse.json({ error: 'No workspace found' }, { status: 404 });
        }

        const { searchParams } = new URL(req.url);
        const parentId = searchParams.get('parentId');
        const trashed = searchParams.get('trashed') === 'true';
        const clientId = searchParams.get('clientId');

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const whereClause: any = {
            workspaceId: member.workspaceId,
            isTrashed: trashed,
        };

        if (clientId) {
            whereClause.clientId = clientId;
        } else {
            whereClause.parentId = parentId || null;
        }

        const pages = await prisma.page.findMany({
            where: whereClause,
            orderBy: { position: 'asc' },
            select: {
                id: true,
                title: true,
                icon: true,
                parentId: true,
                position: true,
                isTrashed: true,
                createdAt: true,
                updatedAt: true,
                _count: { select: { children: true } },
            },
        });

        return NextResponse.json(pages);
    } catch (error) {
        console.error('GET /api/pages error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST /api/pages - Create a new page
export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = (session.user as any).id;
        const member = await prisma.workspaceMember.findFirst({
            where: { userId },
        });

        if (!member) {
            return NextResponse.json({ error: 'No workspace found' }, { status: 404 });
        }

        const body = await req.json();
        const { title, icon, parentId } = body;

        // Get position for new page
        const lastPage = await prisma.page.findFirst({
            where: { workspaceId: member.workspaceId, parentId: parentId || null },
            orderBy: { position: 'desc' },
        });

        const page = await prisma.page.create({
            data: {
                title: title || 'Untitled',
                icon: icon || null,
                parentId: parentId || null,
                workspaceId: member.workspaceId,
                createdById: userId,
                position: (lastPage?.position ?? -1) + 1,
            },
        });

        // Broadcast to all connected browsers
        pushAppEvent('page-created', {
            id: page.id,
            title: page.title,
            icon: page.icon,
            parentId: page.parentId,
            _count: { children: 0 },
        });

        return NextResponse.json(page, { status: 201 });
    } catch (error) {
        console.error('POST /api/pages error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
