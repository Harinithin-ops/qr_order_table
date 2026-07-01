import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/index.js';
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
      // Keep at most 10 connections — prevents EMAXCONNSESSION (Supabase session mode limit = 15)
      max: 10,
      min: 0,
      idleTimeoutMillis: 5000,       // release idle connections quickly on nodemon restart
      connectionTimeoutMillis: 10000,
      allowExitOnIdle: false,
      ssl: {
        rejectUnauthorized: false
      }
    });

    // Log pool errors to prevent unhandled rejections
    globalForPrisma.pgPool.on('error', (err) => {
      console.error('[Prisma Pool] Unexpected pool error:', err.message);
    });

    // Release all connections on process exit so nodemon restarts don't leak sessions
    const endPool = () => {
      globalForPrisma.pgPool?.end().catch(() => {});
    };
    process.once('beforeExit', endPool);
    process.once('SIGTERM', endPool);
    process.once('SIGINT',  endPool);
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
