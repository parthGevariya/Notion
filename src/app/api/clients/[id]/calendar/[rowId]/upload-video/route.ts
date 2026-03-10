import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { uploadToGoogleDrive } from '@/lib/google-drive';

type RouteParams = { params: Promise<{ id: string, rowId: string }> };

// POST /api/clients/[id]/calendar/[rowId]/upload-video
export async function POST(req: NextRequest, { params }: RouteParams) {
    const { id: clientId, rowId } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        // 1. Verify row and client exist
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const row = await (prisma as any).calendarRow.findUnique({
            where: { id: rowId },
            include: { page: { include: { client: true } } }
        });

        if (!row || !row.page.client) {
            return NextResponse.json({ error: 'Row or Client not found' }, { status: 404 });
        }

        const client = row.page.client;
        if (!client.videoFolderId) {
             return NextResponse.json({ error: 'Video folder not configured for this client' }, { status: 400 });
        }

        // 2. Process formData
        const formData = await req.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        console.log(`[drive-upload] Received file ${file.name} for row ${rowId}`);

        // 3. Upload to Google Drive using the client's specific folder
        const buffer = Buffer.from(await file.arrayBuffer());
        const driveLink = await uploadToGoogleDrive(buffer, file.name, file.type, client.videoFolderId);

        // 4. Update the DB with the new drive link
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updatedRow = await (prisma as any).calendarRow.update({
            where: { id: rowId },
            data: { driveLink },
        });

        return NextResponse.json({
            success: true,
            driveLink,
            row: updatedRow
        });

    } catch (error) {
        console.error('Error uploading video:', error);
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
}
