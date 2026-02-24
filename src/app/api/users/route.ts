import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET /api/users — list all workspace users (for dropdowns)
export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const users = await prisma.user.findMany({
        select: { id: true, name: true, avatar: true, role: true },
        orderBy: { name: 'asc' },
    });

    return NextResponse.json(users);
}
