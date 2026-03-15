import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { pushAppEvent } from '@/lib/pushEvent';

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
    if (body.description !== undefined) data.description = body.description;
    if (body.details !== undefined) data.details = body.details;
    if (body.assigneeId !== undefined) data.assigneeId = body.assigneeId;
    if (body.endDate !== undefined) data.endDate = new Date(body.endDate);

    if (body.reviewStatus !== undefined) {
        data.reviewStatus = body.reviewStatus;
        if (body.reviewStatus === 'pending_review') {
            data.status = 'in_review';
        } else if (body.reviewStatus === 'approved') {
            data.status = 'completed';
            data.completedAt = new Date();
        } else if (body.reviewStatus === 'changes_requested') {
            data.status = 'in_progress';
        }
    }

    const reminder = await prisma.reminder.update({
        where: { id },
        data,
        include: {
            assignee: { select: { id: true, name: true, avatar: true } },
            creator: { select: { id: true, name: true, avatar: true } },
        },
    });

    // Broadcast update so all browsers refresh the reminders list
    pushAppEvent('reminder-updated', reminder);

    return NextResponse.json(reminder);
}

// DELETE /api/reminders/[id]
export async function DELETE(req: NextRequest, { params }: RouteParams) {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const reminder = await prisma.reminder.findUnique({ where: { id }, select: { attachmentUrl: true }});
    if (reminder?.attachmentUrl) {
        try {
            // Remove '/uploads/reminders/' prefix to get filename
            const filename = reminder.attachmentUrl.split('/').pop();
            if (filename) {
                const filePath = join(process.cwd(), 'public', 'uploads', 'reminders', filename);
                await unlink(filePath);
            }
        } catch (e) {
            console.error('[Reminder API] Failed to delete attachment file:', e);
        }
    }

    await prisma.reminder.delete({ where: { id } });
    pushAppEvent('reminder-deleted', { id });
    return NextResponse.json({ success: true });
}
