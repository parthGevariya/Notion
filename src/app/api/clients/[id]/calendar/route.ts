import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { pushAppEvent } from '@/lib/pushEvent';

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/clients/[id]/calendar — list calendar rows for a client
export async function GET(req: NextRequest, { params }: RouteParams) {
    const { id: clientId } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        // 1. Find the client's calendar page
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const page = await (prisma as any).page.findFirst({
            where: { clientId, pageType: 'calendar_page' },
        });

        if (!page) {
            return NextResponse.json({ error: 'Calendar page not found for client' }, { status: 404 });
        }

        // 2. Fetch rows
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows = await (prisma as any).calendarRow.findMany({
            where: { pageId: page.id },
            orderBy: { position: 'asc' },
            include: {
                script: true,
                assignee: {
                    select: { id: true, name: true, avatar: true },
                },
                shootPerson: {
                    select: { id: true, name: true, avatar: true },
                },
                editor: {
                    select: { id: true, name: true, avatar: true },
                },
            },
        });

        return NextResponse.json(rows);
    } catch (e) {
        console.error('[calendar GET]', e);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

// POST /api/clients/[id]/calendar — create a new row
export async function POST(req: NextRequest, { params }: RouteParams) {
    const { id: clientId } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const page = await (prisma as any).page.findFirst({
            where: { clientId, pageType: 'calendar_page' },
        });

        if (!page) {
            return NextResponse.json({ error: 'Calendar page not found for client' }, { status: 404 });
        }

        // Get max position to append at the end
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const lastRow = await (prisma as any).calendarRow.findFirst({
            where: { pageId: page.id },
            orderBy: { position: 'desc' },
        });

        const nextPosition = (lastRow?.position ?? -1) + 1;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const newRow = await (prisma as any).calendarRow.create({
            data: {
                pageId: page.id,
                position: nextPosition,
            },
            include: {
                script: true,
                assignee: {
                    select: { id: true, name: true, avatar: true },
                },
                shootPerson: {
                    select: { id: true, name: true, avatar: true },
                },
                editor: {
                    select: { id: true, name: true, avatar: true },
                },
            },
        });

        // Broadcast new row to all users viewing this client's calendar
        pushAppEvent('calendar-row-created', { clientId, row: newRow });

        return NextResponse.json(newRow, { status: 201 });
    } catch (e: any) {
        console.error('[calendar POST]', e);
        return NextResponse.json({ error: e.message || 'Internal error', stack: e.stack }, { status: 500 });
    }
}
