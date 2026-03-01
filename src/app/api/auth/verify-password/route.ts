/**
 * POST /api/auth/verify-password
 * Verifies the current user's password before destructive actions.
 * Body: { password: string }
 * Returns: { valid: true } or 401
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { password } = await req.json();
    if (!password) return NextResponse.json({ error: 'Password required' }, { status: 400 });

    const userId = (session.user as { id: string }).id;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
    if (!user?.passwordHash) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });

    return NextResponse.json({ valid: true });
}
