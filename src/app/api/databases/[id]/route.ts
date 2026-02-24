import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/databases/[id] — get database with rows
export async function GET(req: NextRequest, { params }: RouteParams) {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const database = await prisma.database.findUnique({
        where: { id },
        include: {
            rows: { orderBy: { position: 'asc' } },
        },
    });

    if (!database) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({
        ...database,
        schema: JSON.parse(database.schema),
        viewConfig: database.viewConfig ? JSON.parse(database.viewConfig) : null,
        rows: database.rows.map(r => ({
            ...r,
            properties: JSON.parse(r.properties),
        })),
    });
}

// PATCH /api/databases/[id] — update database (title, schema, viewConfig)
export async function PATCH(req: NextRequest, { params }: RouteParams) {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const updateData: any = {};

    if (body.title !== undefined) updateData.title = body.title;
    if (body.schema !== undefined) updateData.schema = JSON.stringify(body.schema);
    if (body.viewConfig !== undefined) updateData.viewConfig = JSON.stringify(body.viewConfig);
    if (body.icon !== undefined) updateData.icon = body.icon;

    const database = await prisma.database.update({
        where: { id },
        data: updateData,
    });

    return NextResponse.json(database);
}

// DELETE /api/databases/[id]
export async function DELETE(req: NextRequest, { params }: RouteParams) {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await prisma.database.delete({ where: { id } });
    return NextResponse.json({ success: true });
}
