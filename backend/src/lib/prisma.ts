import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

function createPrismaClient() {
  // In serverless (Vercel), pg.Pool needs a direct connection, NOT the pgbouncer URL.
  // Use DIRECT_URL (port 5432) if available, otherwise fall back to DATABASE_URL.
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set in the environment.');
  }

  // Create a pg connection pool (uses direct Postgres connection, not pgbouncer)
  const pool = new pg.Pool({
    connectionString,
    // On Vercel serverless, keep pool small to avoid connection exhaustion
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
  
  // Instantiated with the pg driver adapter as required by Prisma 7
  const adapter = new PrismaPg(pool);
  
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
