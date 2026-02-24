import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET /api/search?q=query — search pages by title and content
export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q')?.trim();

    if (!query || query.length < 2) {
        return NextResponse.json([]);
    }

    const pages = await prisma.page.findMany({
        where: {
            OR: [
                { title: { contains: query } },
                { content: { contains: query } },
            ],
        },
        select: {
            id: true,
            title: true,
            icon: true,
            updatedAt: true,
            createdBy: { select: { name: true } },
            parent: { select: { id: true, title: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 20,
    });

    return NextResponse.json(pages);
}
