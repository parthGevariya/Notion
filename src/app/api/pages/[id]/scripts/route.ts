import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/pages/[id]/scripts — list scripts for a page
export async function GET(req: NextRequest, { params }: RouteParams) {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const scripts = await prisma.script.findMany({
        where: { pageId: id },
        orderBy: { scriptNumber: 'asc' },
    });

    return NextResponse.json(scripts);
}

// POST /api/pages/[id]/scripts — create a new script (auto-numbered)
export async function POST(req: NextRequest, { params }: RouteParams) {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();

    // Get next script number
    const lastScript = await prisma.script.findFirst({
        where: { pageId: id },
        orderBy: { scriptNumber: 'desc' },
    });

    const script = await prisma.script.create({
        data: {
            pageId: id,
            scriptNumber: (lastScript?.scriptNumber ?? 0) + 1,
            title: body.title || '',
            reelLink: body.reelLink || null,
            content: body.content || null,
            status: body.status || 'draft',
            assigneeId: body.assigneeId || null,
        },
    });

    return NextResponse.json(script, { status: 201 });
}
