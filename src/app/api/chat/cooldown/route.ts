import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { addMinutes, isAfter } from 'date-fns';

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    const sessionUser = session?.user as { id?: string; role?: string } | undefined;
    if (!sessionUser?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const cooldown = await prisma.userCooldown.findUnique({
            where: { userId: sessionUser.id }
        });

        if (cooldown && isAfter(new Date(cooldown.endTime), new Date())) {
            return NextResponse.json({ isCoolingDown: true, endTime: cooldown.endTime, reason: cooldown.reason });
        }

        return NextResponse.json({ isCoolingDown: false });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch cooldown status' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    const sessionUser = session?.user as { id?: string; role?: string } | undefined;
    if (!sessionUser?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Only owners and managers can apply cooldowns
    if (sessionUser.role !== 'owner' && sessionUser.role !== 'manager') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const { userId, minutes, reason } = await req.json();
        const endTime = addMinutes(new Date(), minutes);

        const cooldown = await prisma.userCooldown.upsert({
            where: { userId },
            update: { endTime, reason },
            create: { userId, endTime, reason }
        });

        return NextResponse.json(cooldown);
    } catch (error) {
        console.error('Error applying cooldown:', error);
        return NextResponse.json({ error: 'Failed to apply cooldown' }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    const session = await getServerSession(authOptions);
    const sessionUser = session?.user as { id?: string; role?: string } | undefined;
    if (!sessionUser?.id || (sessionUser.role !== 'owner' && sessionUser.role !== 'manager')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    if (!userId) return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 });

    try {
        await prisma.userCooldown.delete({ where: { userId } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error removing cooldown:', error);
        return NextResponse.json({ error: 'Failed to remove cooldown' }, { status: 500 });
    }
}
