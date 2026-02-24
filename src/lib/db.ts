import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'path';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getDbPath(): string {
  // Strip the 'file:' prefix from DATABASE_URL if present
  const envUrl = process.env.DATABASE_URL || '';
  if (envUrl.startsWith('file:')) {
    const stripped = envUrl.slice(5);
    // If it's already absolute, use it directly
    if (path.isAbsolute(stripped)) return stripped;
    // Otherwise resolve relative to CWD
    return path.resolve(process.cwd(), stripped);
  }
  // Default: prisma/dev.db relative to project root
  return path.resolve(process.cwd(), 'prisma', 'dev.db');
}

function createPrismaClient() {
  const dbPath = getDbPath();
  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
