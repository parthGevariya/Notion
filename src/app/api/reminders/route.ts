import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { pushAppEvent } from '@/lib/pushEvent';

const COLLAB_URL = process.env.COLLAB_SERVER_URL || 'http://localhost:3001';

// GET /api/reminders — list reminders for current user
export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = (session.user as any).id;
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get('filter') || 'all';

    const where: any = {};
    if (filter === 'assigned') {
        where.assigneeId = userId;
    } else if (filter === 'created') {
        where.creatorId = userId;
    } else {
        where.OR = [{ assigneeId: userId }, { creatorId: userId }];
    }

    const reminders = await prisma.reminder.findMany({
        where,
        include: {
            assignee: { select: { id: true, name: true, avatar: true } },
            creator: { select: { id: true, name: true, avatar: true } },
            children: { select: { id: true, assigneeId: true, status: true } },
        },
        orderBy: { endDate: 'asc' },
    });

    return NextResponse.json(reminders);
}

// POST /api/reminders — create a reminder & notify assignee in real-time
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const creatorId = (session.user as any).id;
    const creatorName = session.user.name || 'Someone';

    if (!body.title || !body.assigneeId || !body.endDate) {
        return NextResponse.json({ error: 'title, assigneeId, endDate required' }, { status: 400 });
    }

    try {
        const reminder = await prisma.reminder.create({
            data: {
                title: body.title,
                description: body.description || body.details || null,
                details: body.details || null,
                assigneeId: body.assigneeId,
                creatorId,
                endDate: new Date(body.endDate),
                parentId: body.parentId || null,
                attachmentUrl: body.attachmentUrl || null,
                attachmentName: body.attachmentName || null,
                attachmentType: body.attachmentType || null,
            },
            include: {
                assignee: { select: { id: true, name: true, avatar: true } },
                creator: { select: { id: true, name: true, avatar: true } },
            },
        });
        
        // ── Real-time notification to the assignee ──────────────────────────────
        if (body.assigneeId !== creatorId) {
            try {
                const notification = await prisma.notification.create({
                    data: {
                        userId: body.assigneeId,
                        title: 'New Task Assigned',
                        message: `${creatorName} assigned you a task: "${body.title}"`,
                        type: 'task',
                        link: '/reminders',
                    },
                });

                // Push real-time event via collab-server HTTP endpoint (fire-and-forget)
                fetch(`${COLLAB_URL}/push-notification`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: body.assigneeId, notification }),
                }).catch((e) => console.warn('[Notif] Could not reach collab-server:', e.message));
            } catch (e) {
                console.error('[Notif] Failed to create notification:', e);
            }
        }
        // ────────────────────────────────────────────────────────────────────────

        // Broadcast to all browsers so the reminders page updates live
        pushAppEvent('reminder-created', reminder);

        return NextResponse.json(reminder, { status: 201 });
    } catch (error: any) {
        console.error('[Reminder API] Create error:', error);
        return NextResponse.json({ 
            error: 'Failed to create reminder', 
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, { status: 500 });
    }
}
