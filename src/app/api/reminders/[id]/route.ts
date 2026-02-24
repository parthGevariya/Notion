import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

type RouteParams = { params: Promise<{ id: string }> };

// PATCH /api/reminders/[id] — update status, re-assign, complete
export async function PATCH(req: NextRequest, { params }: RouteParams) {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const data: any = {};

    if (body.status !== undefined) {
        data.status = body.status;
        if (body.status === 'completed') data.completedAt = new Date();
    }
    if (body.title !== undefined) data.title = body.title;
    if (body.details !== undefined) data.details = body.details;
    if (body.assigneeId !== undefined) data.assigneeId = body.assigneeId;
    if (body.endDate !== undefined) data.endDate = new Date(body.endDate);

    const reminder = await prisma.reminder.update({
        where: { id },
        data,
        include: {
            assignee: { select: { id: true, name: true, avatar: true } },
            creator: { select: { id: true, name: true, avatar: true } },
        },
    });

    return NextResponse.json(reminder);
}

// DELETE /api/reminders/[id]
export async function DELETE(req: NextRequest, { params }: RouteParams) {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await prisma.reminder.delete({ where: { id } });
    return NextResponse.json({ success: true });
}
