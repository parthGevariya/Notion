/**
 * /api/clients/[id]/sync-doc
 * POST → Trigger a Google Docs sync (stub until API key provided)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    console.log(`[sync-doc] TODO: sync client ${id} — awaiting API key`);
    return NextResponse.json({
        message: 'Google Docs sync not yet activated. Add GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN to .env to enable.',
    });
}
