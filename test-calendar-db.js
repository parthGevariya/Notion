const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const path = require('path');

async function main() {
    const dbPath = path.resolve(process.cwd(), 'prisma', 'dev.db');
    console.log('Using DB at:', dbPath);
    const adapter = new PrismaBetterSqlite3({ url: dbPath });
    const db = new PrismaClient({ adapter });

    try {
        console.log('Fetching calendar rows...');
        const rows = await db.calendarRow.findMany({
            include: {
                script: true,
                assignee: {
                    select: { id: true, name: true, avatar: true },
                },
            },
        });
        console.log('Success:', rows);
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await db.$disconnect();
    }
}

main();
