import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

type RouteParams = { params: Promise<{ id: string }> };

// POST /api/databases/[id]/rows — add a new row
export async function POST(req: NextRequest, { params }: RouteParams) {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { properties } = body;

    // Get next position
    const lastRow = await prisma.databaseRow.findFirst({
        where: { databaseId: id },
        orderBy: { position: 'desc' },
    });

    const row = await prisma.databaseRow.create({
        data: {
            databaseId: id,
            properties: JSON.stringify(properties || {}),
            position: (lastRow?.position ?? -1) + 1,
        },
    });

    return NextResponse.json({ ...row, properties: JSON.parse(row.properties) }, { status: 201 });
}

// PATCH /api/databases/[id]/rows — update a row (body: {rowId, properties})
export async function PATCH(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { rowId, properties, position } = body;

    const updateData: any = {};
    if (properties !== undefined) updateData.properties = JSON.stringify(properties);
    if (position !== undefined) updateData.position = position;

    const row = await prisma.databaseRow.update({
        where: { id: rowId },
        data: updateData,
    });

    return NextResponse.json({ ...row, properties: JSON.parse(row.properties) });
}

// DELETE /api/databases/[id]/rows — delete a row (body: {rowId})
export async function DELETE(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { rowId } = await req.json();
    await prisma.databaseRow.delete({ where: { id: rowId } });
    return NextResponse.json({ success: true });
}
