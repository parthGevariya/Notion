const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testCalendarFlow() {
    try {
        console.log('1. Finding workspace...');
        const workspace = await prisma.workspace.findFirst();
        if (!workspace) throw new Error("No workspace found");

        console.log('2. Finding a user...');
        const user = await prisma.user.findFirst();
        if (!user) throw new Error("No user found");

        console.log('3. Creating test client...');
        const client = await prisma.client.create({
            data: {
                name: 'API Fallback Verification Client',
                emoji: '🧪',
                workspaceId: workspace.id,
            },
        });

        console.log(`4. Creating calendar page for ${client.id}...`);
        const page = await prisma.page.create({
            data: {
                title: `Verification — Calendar`,
                icon: '📅',
                workspaceId: workspace.id,
                createdById: user.id,
                pageType: 'calendar_page',
                clientId: client.id,
            },
        });

        console.log(`5. Creating calendar row on page ${page.id}...`);
        const newRow = await prisma.calendarRow.create({
            data: {
                pageId: page.id,
                position: 0,
                title: 'Backend Verification Shot',
                status: 'Shooting',
                caption: 'This proves the NextJS Prisma 500 error is resolved.',
            },
            include: { script: true, assignee: true },
        });

        console.log('Success! Row created:', newRow);
    } catch (err) {
        console.error('Test Flow Failed:', err);
    } finally {
        await prisma.$disconnect();
    }
}

testCalendarFlow();
