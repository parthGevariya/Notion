import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET /api/reminders — list reminders for current user
export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = (session.user as any).id;
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get('filter') || 'all'; // all, assigned, created

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

// POST /api/reminders — create a reminder
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const creatorId = (session.user as any).id;

    if (!body.title || !body.assigneeId || !body.endDate) {
        return NextResponse.json({ error: 'title, assigneeId, endDate required' }, { status: 400 });
    }

    const reminder = await prisma.reminder.create({
        data: {
            title: body.title,
            details: body.details || null,
            assigneeId: body.assigneeId,
            creatorId,
            endDate: new Date(body.endDate),
            parentId: body.parentId || null,
        },
        include: {
            assignee: { select: { id: true, name: true, avatar: true } },
            creator: { select: { id: true, name: true, avatar: true } },
        },
    });

    return NextResponse.json(reminder, { status: 201 });
}
