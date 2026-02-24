import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

// Default columns for a new database
const DEFAULT_SCHEMA = [
    { id: 'title', name: 'Name', type: 'title', width: 260 },
    { id: 'col_status', name: 'Status', type: 'select', width: 150, options: ['Not started', 'In progress', 'Done'] },
    { id: 'col_assignee', name: 'Assignee', type: 'person', width: 150 },
    { id: 'col_date', name: 'Date', type: 'date', width: 150 },
    { id: 'col_tags', name: 'Tags', type: 'multi_select', width: 200, options: ['Design', 'Dev', 'Marketing', 'Content'] },
];

// GET /api/databases — list databases for workspace
export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = (session.user as any).id;
    const member = await prisma.workspaceMember.findFirst({ where: { userId } });
    if (!member) return NextResponse.json({ error: 'No workspace' }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const pageId = searchParams.get('pageId');

    const databases = await prisma.database.findMany({
        where: {
            workspaceId: member.workspaceId,
            ...(pageId ? { pageId } : {}),
        },
        orderBy: { createdAt: 'desc' },
        include: {
            _count: { select: { rows: true } },
        },
    });

    return NextResponse.json(databases);
}

// POST /api/databases — create a new database
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = (session.user as any).id;
    const member = await prisma.workspaceMember.findFirst({ where: { userId } });
    if (!member) return NextResponse.json({ error: 'No workspace' }, { status: 404 });

    const body = await req.json();
    const { title, pageId, schema } = body;

    const database = await prisma.database.create({
        data: {
            title: title || 'Untitled Database',
            pageId: pageId || null,
            workspaceId: member.workspaceId,
            schema: JSON.stringify(schema || DEFAULT_SCHEMA),
            viewConfig: JSON.stringify({ defaultView: 'table' }),
        },
    });

    return NextResponse.json(database, { status: 201 });
}
