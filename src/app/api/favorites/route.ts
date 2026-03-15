import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { pushAppEvent } from '@/lib/pushEvent';

// GET /api/favorites
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = (session.user as any).id;
        const favorites = await prisma.favorite.findMany({
            where: { userId },
            orderBy: { position: 'asc' },
            include: {
                page: {
                    select: { id: true, title: true, icon: true, isTrashed: true },
                },
            },
        });

        return NextResponse.json(favorites.filter(f => !f.page.isTrashed));
    } catch (error) {
        console.error('GET /api/favorites error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST /api/favorites - Toggle favorite
export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = (session.user as any).id;
        const { pageId } = await req.json();

        const existing = await prisma.favorite.findUnique({
            where: { userId_pageId: { userId, pageId } },
        });

        if (existing) {
            await prisma.favorite.delete({ where: { id: existing.id } });
            pushAppEvent('favorite-changed', { userId });
            return NextResponse.json({ favorited: false });
        }

        const lastFav = await prisma.favorite.findFirst({
            where: { userId },
            orderBy: { position: 'desc' },
        });

        await prisma.favorite.create({
            data: {
                userId,
                pageId,
                position: (lastFav?.position ?? -1) + 1,
            },
        });

        pushAppEvent('favorite-changed', { userId });
        return NextResponse.json({ favorited: true });
    } catch (error) {
        console.error('POST /api/favorites error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
