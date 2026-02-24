import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import prisma from '@/lib/db';
import { ROLES } from '@/lib/types';

export async function POST(req: NextRequest) {
    try {
        const { name, email, password } = await req.json();

        if (!name || !email || !password) {
            return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
        }

        if (password.length < 6) {
            return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
        }

        // Check if user already exists
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
        }

        // First user becomes owner
        const userCount = await prisma.user.count();
        const role = userCount === 0 ? ROLES.OWNER : ROLES.CONTENT_WRITER;

        const passwordHash = await hash(password, 12);

        const user = await prisma.user.create({
            data: {
                name,
                email,
                passwordHash,
                role,
            },
        });

        // If first user, create default workspace
        if (userCount === 0) {
            await prisma.workspace.create({
                data: {
                    name: 'My Workspace',
                    icon: '🏠',
                    members: {
                        create: {
                            userId: user.id,
                            role: ROLES.OWNER,
                        },
                    },
                },
            });
        } else {
            // Add to first workspace
            const workspace = await prisma.workspace.findFirst();
            if (workspace) {
                await prisma.workspaceMember.create({
                    data: {
                        workspaceId: workspace.id,
                        userId: user.id,
                        role,
                    },
                });
            }
        }

        return NextResponse.json({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
        }, { status: 201 });
    } catch (error) {
        console.error('Registration error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
