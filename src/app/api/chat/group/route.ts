import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

const COLLAB_URL = process.env.COLLAB_SERVER_URL || 'http://localhost:3001';

// GET /api/chat/group — fetch group messages
export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const messages = await prisma.chatMessage.findMany({
        where: { receiverId: null as any },
        include: {
            sender: { select: { id: true, name: true, avatar: true, role: true } },
        },
        orderBy: { createdAt: 'asc' },
        take: 200,
    });

    return NextResponse.json(messages);
}

// POST /api/chat/group — send a group message + handle @mentions
export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    const senderId = (session?.user as { id?: string })?.id;
    const senderName = session?.user?.name || 'Someone';
    if (!session?.user || !senderId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const json = await req.json();
        const { content, mediaUrl, mediaType, mentionedUserIds } = json;

        if (!content && !mediaUrl) {
            return NextResponse.json({ error: 'Content or media is required' }, { status: 400 });
        }

        const message = await prisma.chatMessage.create({
            data: {
                content: content || null,
                mediaUrl: mediaUrl || null,
                mediaType: mediaType || null,
                senderId,
                receiverId: null,
            } as any,
            include: {
                sender: { select: { id: true, name: true, avatar: true, role: true } },
            },
        });

        // ── @Mention notifications ──────────────────────────────────────────
        let targets = mentionedUserIds && Array.isArray(mentionedUserIds) ? mentionedUserIds : [];
        if (targets.includes('all')) {
            const allUsers = await prisma.user.findMany({ select: { id: true } });
            targets = allUsers.map(u => u.id);
        }

        if (targets.length > 0) {
            for (const mentionedId of targets) {
                if (mentionedId === senderId) continue; // Don't notify self

                try {
                    // Create notification in DB
                    const notification = await prisma.notification.create({
                        data: {
                            userId: mentionedId,
                            title: 'You were mentioned',
                            message: `${senderName} mentioned you in group chat${content ? `: "${content.slice(0, 60)}..."` : ''}`,
                            type: 'mention',
                            link: '/chat',
                        },
                    });

                    // Push real-time mention notification
                    fetch(`${COLLAB_URL}/push-notification`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userId: mentionedId,
                            notification: { ...notification, type: 'mention' },
                        }),
                    }).catch((e) => console.warn('[Mention] Collab push failed:', e.message));
                } catch (e) {
                    console.error('[Mention] Failed to notify:', mentionedId, e);
                }
            }
        }
        // ────────────────────────────────────────────────────────────────────

        return NextResponse.json(message);
    } catch (error) {
        console.error('Error creating group message:', error);
        return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
    }
}

// DELETE /api/chat/group — clear all messages or media only (manager+owner)
export async function DELETE(req: Request) {
    const session = await getServerSession(authOptions);
    const sessionUser = session?.user as { id?: string; role?: string } | undefined;
    if (!sessionUser?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (sessionUser.role !== 'owner' && sessionUser.role !== 'manager') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const { mode } = await req.json() as { mode: 'all' | 'media' };

        if (mode === 'all') {
            await prisma.chatMessage.deleteMany({ where: { receiverId: undefined } });
        } else if (mode === 'media') {
            await prisma.chatMessage.updateMany({
                where: { receiverId: undefined, NOT: { mediaUrl: undefined } },
                data: { mediaUrl: null, mediaType: null },
            });
        } else {
            return NextResponse.json({ error: 'mode must be "all" or "media"' }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error clearing group chat:', error);
        return NextResponse.json({ error: 'Failed to clear chat' }, { status: 500 });
    }
}
