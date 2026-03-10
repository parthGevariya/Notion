import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

type RouteParams = { params: Promise<{ id: string, rowId: string }> };

// PATCH /api/clients/[id]/calendar/[rowId] — Update a calendar row
export async function PATCH(req: NextRequest, { params }: RouteParams) {
    const { id: clientId, rowId } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const data = await req.json();

    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updatedRow = await (prisma as any).calendarRow.update({
            where: { id: rowId },
            data: {
                date: data.date ? new Date(data.date) : data.date === null ? null : undefined,
                postDate: data.postDate ? new Date(data.postDate) : data.postDate === null ? null : undefined,
                shootDate: data.shootDate ? new Date(data.shootDate) : data.shootDate === null ? null : undefined,
                title: data.title,
                scriptId: data.scriptId,
                scriptDetails: data.scriptDetails,
                caption: data.caption,
                thumbnail: data.thumbnail,
                status: data.status,
                shootStatus: data.shootStatus,
                shootPersonId: data.shootPersonId,
                editStatus: data.editStatus,
                editorId: data.editorId,
                assigneeId: data.assigneeId,
                approvalStatus: data.approvalStatus,
                approvalMsg: data.approvalMsg,
                socialMedia: data.socialMedia,
                position: data.position,
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

        return NextResponse.json(updatedRow);
    } catch (error) {
        console.error('Error updating calendar row:', error);
        return NextResponse.json({ error: 'Failed to update row' }, { status: 500 });
    }
}

// DELETE /api/clients/[id]/calendar/[rowId] — Delete a calendar row
export async function DELETE(req: NextRequest, { params }: RouteParams) {
    const { id: clientId, rowId } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (prisma as any).calendarRow.delete({
            where: { id: rowId },
        });

        // Optional: Re-sequence positions here if needed, but flex-ordering is usually fine.

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting calendar row:', error);
        return NextResponse.json({ error: 'Failed to delete row' }, { status: 500 });
    }
}
