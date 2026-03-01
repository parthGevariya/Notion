const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(process.cwd(), 'prisma', 'dev.db');
console.log('Opening SQLite at', dbPath);

try {
    const db = new Database(dbPath, { readonly: true });

    // Test 1: Does the table exist?
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const hasCalendarRow = tables.some(t => t.name === 'CalendarRow');
    console.log('CalendarRow table exists?', hasCalendarRow);

    if (hasCalendarRow) {
        const rows = db.prepare("SELECT * FROM CalendarRow LIMIT 5").all();
        console.log(`Found ${rows.length} rows in CalendarRow.`);
        console.log(rows);
    } else {
        console.log('All Tables:', tables.map(t => t.name));
    }
} catch (e) {
    console.error('Raw SQLite Error:', e);
}
