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
        const file = formData.get('image') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No image provided' }, { status: 400 });
        }

        // Validate it's actually an image
        if (!file.type.startsWith('image/')) {
            return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 });
        }

        // 5MB max (compression should keep it well below)
        if (file.size > 5 * 1024 * 1024) {
            return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Determine extension
        const ext = file.type === 'image/png' ? 'png' : 'jpg';
        const filename = `${randomUUID()}.${ext}`;

        // Save to public/uploads/chat/
        const uploadDir = join(process.cwd(), 'public', 'uploads', 'chat');
        await mkdir(uploadDir, { recursive: true });
        await writeFile(join(uploadDir, filename), buffer);

        const url = `/uploads/chat/${filename}`;
        return NextResponse.json({ url }, { status: 201 });
    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
}
