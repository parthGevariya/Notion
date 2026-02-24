import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

type RouteParams = { params: Promise<{ id: string; scriptId: string }> };

// PATCH /api/pages/[id]/scripts/[scriptId] — update a script
export async function PATCH(req: NextRequest, { params }: RouteParams) {
    const { scriptId } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const updateData: any = {};

    if (body.title !== undefined) updateData.title = body.title;
    if (body.reelLink !== undefined) updateData.reelLink = body.reelLink;
    if (body.content !== undefined) updateData.content = body.content;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.assigneeId !== undefined) updateData.assigneeId = body.assigneeId;

    const script = await prisma.script.update({
        where: { id: scriptId },
        data: updateData,
    });

    return NextResponse.json(script);
}

// DELETE /api/pages/[id]/scripts/[scriptId]
export async function DELETE(req: NextRequest, { params }: RouteParams) {
    const { scriptId } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await prisma.script.delete({ where: { id: scriptId } });
    return NextResponse.json({ success: true });
}
