import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
    try {
        // @ts-ignore
        const rows = await prisma.calendarRow.findMany();
        return NextResponse.json({ success: true, count: rows.length, rows });
    } catch (e: any) {
        return NextResponse.json({ error: String(e), stack: e.stack }, { status: 500 });
    }
}
