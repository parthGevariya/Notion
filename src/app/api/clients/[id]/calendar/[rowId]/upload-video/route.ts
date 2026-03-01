import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

type RouteParams = { params: Promise<{ id: string, rowId: string }> };

// POST /api/clients/[id]/calendar/[rowId]/upload-video
export async function POST(req: NextRequest, { params }: RouteParams) {
    const { id: clientId, rowId } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        // 1. Verify row exists
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const row = await (prisma as any).calendarRow.findUnique({
            where: { id: rowId },
        });

        if (!row) {
            return NextResponse.json({ error: 'Row not found' }, { status: 404 });
        }

        // 2. We'd normally process formData here but this is a stub
        const formData = await req.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        console.log(`[drive-upload] Received file ${file.name} for row ${rowId}`);

        // 3. Stub the Drive Upload Process
        // In reality, we would call uploadToGoogleDrive(file, client.driveFolder)

        // Simulating a slow upload network request
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Mock successful Drive URL
        const mockDriveLink = `https://drive.google.com/file/d/stub_${Date.now()}/view`;

        // 4. Update the DB with the new drive link
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updatedRow = await (prisma as any).calendarRow.update({
            where: { id: rowId },
            data: { driveLink: mockDriveLink },
        });

        return NextResponse.json({
            success: true,
            driveLink: mockDriveLink,
            row: updatedRow
        });

    } catch (error) {
        console.error('Error uploading video:', error);
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
}
