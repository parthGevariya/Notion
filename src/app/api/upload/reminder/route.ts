import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // 500MB max for tasks
        if (file.size > 500 * 1024 * 1024) {
            return NextResponse.json({ error: 'File too large (max 500MB)' }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Determine extension reliably, otherwise fall back to name fallback or bin
        const originalName = file.name;
        const extMatch = originalName.match(/\.([^.]+)$/);
        const ext = extMatch ? extMatch[1] : 'bin';
        const filename = `${randomUUID()}.${ext}`;

        // Save to public/uploads/reminders/
        const uploadDir = join(process.cwd(), 'public', 'uploads', 'reminders');
        await mkdir(uploadDir, { recursive: true });
        await writeFile(join(uploadDir, filename), buffer);

        const url = `/uploads/reminders/${filename}`;
        
        let fileType = 'file';
        if (file.type.startsWith('image/')) fileType = 'image';
        else if (file.type.startsWith('video/')) fileType = 'video';
        
        return NextResponse.json({ 
            url, 
            name: originalName,
            type: fileType 
        }, { status: 201 });
    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
}
