import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'path';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getDbPath(): string {
  const envUrl = process.env.DATABASE_URL || '';
  if (envUrl.startsWith('file:')) {
    let stripped = envUrl.slice(5);
    // Relative paths in .env are usually meant to be resolved against the project root
    if (path.isAbsolute(stripped)) return stripped;

    // If it's ../dev.db (because we fixed .env for the CLI), just put it in root
    return path.resolve(process.cwd(), stripped);
  }
  return path.resolve(process.cwd(), 'dev.db');
}

function createPrismaClient() {
  const dbPath = getDbPath();
  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
