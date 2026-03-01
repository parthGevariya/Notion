import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;
    if (!session?.user || !userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const notifications = await prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 20
        });
        return NextResponse.json(notifications);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;
    if (!session?.user || !userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { action, id } = await req.json();

        if (action === 'mark_all_read') {
            await prisma.notification.updateMany({
                where: { userId, isRead: false },
                data: { isRead: true }
            });
        } else if (action === 'mark_read' && id) {
            await prisma.notification.update({
                where: { id, userId },
                data: { isRead: true }
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating notifications:', error);
        return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;
    if (!session?.user || !userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        await prisma.notification.deleteMany({
            where: { userId, isRead: true } // only delete read notifications
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting notifications:', error);
        return NextResponse.json({ error: 'Failed to delete notifications' }, { status: 500 });
    }
}
