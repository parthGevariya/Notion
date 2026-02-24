import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET /api/pages/[id] - Get single page with content
export async function GET(req: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const page = await prisma.page.findUnique({
            where: { id },
            include: {
                children: {
                    where: { isTrashed: false },
                    orderBy: { position: 'asc' },
                    select: { id: true, title: true, icon: true, position: true },
                },
                createdBy: {
                    select: { id: true, name: true, avatar: true },
                },
            },
        });

        if (!page) {
            return NextResponse.json({ error: 'Page not found' }, { status: 404 });
        }

        return NextResponse.json(page);
    } catch (error) {
        console.error('GET /api/pages/[id] error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH /api/pages/[id] - Update page
export async function PATCH(req: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { title, icon, coverImage, content, parentId, position, isTrashed } = body;

        const updateData: any = {};
        if (title !== undefined) updateData.title = title;
        if (icon !== undefined) updateData.icon = icon;
        if (coverImage !== undefined) updateData.coverImage = coverImage;
        if (content !== undefined) updateData.content = content;
        if (parentId !== undefined) updateData.parentId = parentId;
        if (position !== undefined) updateData.position = position;
        if (isTrashed !== undefined) updateData.isTrashed = isTrashed;

        const page = await prisma.page.update({
            where: { id },
            data: updateData,
        });

        return NextResponse.json(page);
    } catch (error) {
        console.error('PATCH /api/pages/[id] error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE /api/pages/[id] - Permanently delete page
export async function DELETE(req: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await prisma.page.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('DELETE /api/pages/[id] error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
