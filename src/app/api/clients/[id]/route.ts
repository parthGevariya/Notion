/**
 * /api/clients/[id] — Get, update, and delete a specific client
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';

// Next.js 16 requires params to be a Promise
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = await (prisma as any).client.findUnique({
        where: { id },
        include: {
            pages: {
                where: { isTrashed: false },
                select: { id: true, pageType: true, title: true, icon: true },
            },
        },
    });
    if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(client);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const role = (session.user as { role?: string }).role || 'viewer';
    const isAdmin = role === 'owner' || role === 'manager';
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const body = await req.json();
    const { name, emoji, googleDocId, driveFolder, settings, createPermission } = body;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = await (prisma as any).client.update({
        where: { id },
        data: {
            ...(name && { name }),
            ...(emoji !== undefined && { emoji }),
            ...(googleDocId !== undefined && { googleDocId }),
            ...(driveFolder !== undefined && { driveFolder }),
            ...(settings !== undefined && { settings: JSON.stringify(settings) }),
            ...(createPermission && { createPermission }),
        },
    });
    return NextResponse.json(client);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const role = (session.user as { role?: string }).role || 'viewer';
    if (role !== 'owner' && role !== 'manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).client.delete({ where: { id } });
    return NextResponse.json({ ok: true });
}
