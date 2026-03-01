import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

type Params = Promise<{ userId: string }>;

export async function GET(req: Request, { params }: { params: Params }) {
    const session = await getServerSession(authOptions);
    const currentUserId = (session?.user as { id?: string })?.id;
    if (!session?.user || !currentUserId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId: otherUserId } = await params;
    const url = new URL(req.url);
    const skip = parseInt(url.searchParams.get('skip') || '0', 10);
    const take = parseInt(url.searchParams.get('take') || '50', 10);

    try {
        const messages = await prisma.chatMessage.findMany({
            where: {
                OR: [
                    { senderId: currentUserId, receiverId: otherUserId },
                    { senderId: otherUserId, receiverId: currentUserId },
                ],
            },
            include: {
                sender: { select: { id: true, name: true, avatar: true, role: true } },
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take,
        });

        return NextResponse.json(messages.reverse());
    } catch (error) {
        console.error('Error fetching DM messages:', error);
        return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    }
}

export async function POST(req: Request, { params }: { params: Params }) {
    const session = await getServerSession(authOptions);
    const currentUserId = (session?.user as { id?: string })?.id;
    if (!session?.user || !currentUserId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId: otherUserId } = await params;

    try {
        const json = await req.json();
        const { content, mediaUrl, mediaType } = json;

        if (!content && !mediaUrl) {
            return NextResponse.json({ error: 'Content or media is required' }, { status: 400 });
        }

        const message = await prisma.chatMessage.create({
            data: {
                content,
                mediaUrl,
                mediaType,
                senderId: currentUserId,
                receiverId: otherUserId,
            },
            include: {
                sender: { select: { id: true, name: true, avatar: true, role: true } },
            },
        });

        return NextResponse.json(message);
    } catch (error) {
        console.error('Error sending DM:', error);
        return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
    }
}
