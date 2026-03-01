import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET /api/chat — list conversations (grouped by partner user)
export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = (session.user as any).id;
    const { searchParams } = new URL(req.url);
    const partnerId = searchParams.get('partnerId');

    if (partnerId) {
        // Get messages with specific partner
        const messages = await prisma.chatMessage.findMany({
            where: {
                OR: [
                    { senderId: userId, receiverId: partnerId },
                    { senderId: partnerId, receiverId: userId },
                ],
            },
            include: {
                sender: { select: { id: true, name: true, avatar: true } },
            },
            orderBy: { createdAt: 'asc' },
            take: 100,
        });

        // Mark as read
        await prisma.chatMessage.updateMany({
            where: { senderId: partnerId, receiverId: userId, isRead: false },
            data: { isRead: true },
        });

        return NextResponse.json(messages);
    }

    // List all conversations (latest message per partner)
    const sent = await prisma.chatMessage.findMany({
        where: { senderId: userId },
        select: { receiverId: true },
        distinct: ['receiverId'],
    });

    const received = await prisma.chatMessage.findMany({
        where: { receiverId: userId },
        select: { senderId: true },
        distinct: ['senderId'],
    });

    const partnerIds = [...new Set([
        ...sent.map(m => m.receiverId),
        ...received.map(m => m.senderId),
    ])].filter((id): id is string => id !== null);

    const conversations = await Promise.all(
        partnerIds.map(async (pid) => {
            const lastMessage = await prisma.chatMessage.findFirst({
                where: {
                    OR: [
                        { senderId: userId, receiverId: pid },
                        { senderId: pid, receiverId: userId },
                    ],
                },
                orderBy: { createdAt: 'desc' },
            });

            const unread = await prisma.chatMessage.count({
                where: { senderId: pid, receiverId: userId, isRead: false },
            });

            const partner = await prisma.user.findUnique({
                where: { id: pid },
                select: { id: true, name: true, avatar: true, role: true },
            });

            return { partner, lastMessage, unreadCount: unread };
        })
    );

    conversations.sort((a, b) => {
        const aTime = a.lastMessage?.createdAt?.getTime() || 0;
        const bTime = b.lastMessage?.createdAt?.getTime() || 0;
        return bTime - aTime;
    });

    return NextResponse.json(conversations);
}

// POST /api/chat — send a message
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const senderId = (session.user as any).id;

    if (!body.receiverId || !body.content) {
        return NextResponse.json({ error: 'receiverId and content required' }, { status: 400 });
    }

    const message = await prisma.chatMessage.create({
        data: {
            senderId,
            receiverId: body.receiverId,
            content: body.content,
        },
        include: {
            sender: { select: { id: true, name: true, avatar: true } },
        },
    });

    return NextResponse.json(message, { status: 201 });
}
