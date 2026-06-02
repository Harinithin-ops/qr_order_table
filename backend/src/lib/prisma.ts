import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

// Track pool instance to avoid creating multiple pools on hot-reload
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: pg.Pool | undefined;
};

function createPrismaClient(): PrismaClient {
  // Use DIRECT_URL (port 5432, native Postgres) instead of DATABASE_URL
  // (port 6543, pgbouncer). pg.Pool is incompatible with pgbouncer transaction mode.
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL or DIRECT_URL must be set in environment variables.');
  }

  if (!globalForPrisma.pgPool) {
    globalForPrisma.pgPool = new pg.Pool({
      connectionString,
      // Conservative pool size for serverless (Vercel functions share nothing)
      max: 3,
      min: 0,
      idleTimeoutMillis: 20000,
      connectionTimeoutMillis: 10000,
      // Retry failed connections
      allowExitOnIdle: false,
      ssl: {
        rejectUnauthorized: false
      }
    });

    // Log pool errors to prevent unhandled rejections
    globalForPrisma.pgPool.on('error', (err) => {
      console.error('[Prisma Pool] Unexpected pool error:', err.message);
    });
  }

  const adapter = new PrismaPg(globalForPrisma.pgPool);
  return new PrismaClient({ adapter });
}

// Singleton pattern — reuse across requests in the same process
export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

// Always persist the singleton (not just in dev) to prevent connection leaks
// in serverless environments where global state persists across warm invocations
globalForPrisma.prisma = prisma;
