const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const path = require('path');

async function main() {
    const dbPath = path.resolve(process.cwd(), 'prisma', 'dev.db');
    const adapter = new PrismaBetterSqlite3({ url: dbPath });
    const db = new PrismaClient({ adapter });

    try {
        const clients = await db.client.findMany({
            include: {
                pages: true
            }
        });
        console.log(JSON.stringify(clients, null, 2));
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await db.$disconnect();
    }
}

main();
