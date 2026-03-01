import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

type RouteParams = { params: Promise<{ id: string }> };

// PATCH /api/users/[id] — update user (role change, only owner/manager)
export async function PATCH(req: NextRequest, { params }: RouteParams) {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const currentRole = (session.user as any).role;
    if (currentRole !== 'owner' && currentRole !== 'manager') {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await req.json();
    const data: any = {};

    if (body.role !== undefined) data.role = body.role;
    if (body.name !== undefined) data.name = body.name;
    if (body.isActive !== undefined) data.isActive = body.isActive;

    const user = await prisma.user.update({
        where: { id },
        data,
        select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    return NextResponse.json(user);
}

// DELETE /api/users/[id] — remove a team member (owner/manager only, cannot delete self)
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const currentRole = (session.user as any).role;
    if (currentRole !== 'owner' && currentRole !== 'manager') {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const currentUserId = (session.user as { id: string }).id;

    // Cannot delete yourself
    if (id === currentUserId) {
        return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 });
    }

    try {
        await prisma.user.delete({ where: { id } });
        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error('[users DELETE]', e);
        return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
    }
}
