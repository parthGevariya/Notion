import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { deleteFile, extractDriveFileId } from '@/lib/google-drive';

type RouteParams = { params: Promise<{ id: string, rowId: string }> };

export async function DELETE(req: NextRequest, { params }: RouteParams) {
    const { rowId } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const row = await (prisma as any).calendarRow.findUnique({
            where: { id: rowId },
            select: { thumbnail: true }
        });

        if (!row) {
            return NextResponse.json({ error: 'Row not found' }, { status: 404 });
        }

        if (row.thumbnail && !row.thumbnail.startsWith('uploading...')) {
            const fileId = extractDriveFileId(row.thumbnail);
            if (fileId) {
                try {
                    await deleteFile(fileId);
                } catch (err) {
                    console.error('[delete-thumbnail] Failed to delete file from Drive:', err);
                }
            }
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updatedRow = await (prisma as any).calendarRow.update({
            where: { id: rowId },
            data: { thumbnail: null },
        });

        return NextResponse.json({ success: true, row: updatedRow });

    } catch (error) {
        console.error('Error deleting thumbnail:', error);
        return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
    }
}
