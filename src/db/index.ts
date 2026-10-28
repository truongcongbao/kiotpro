import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import * as schema from './schema.ts';

export const createPool = () => {
  const host = process.env.SQL_HOST;
  const user = process.env.SQL_USER || process.env.SQL_ADMIN_USER;
  const password = process.env.SQL_PASSWORD || process.env.SQL_ADMIN_PASSWORD;
  const database = process.env.SQL_DB_NAME;

  console.log("Initializing PostgreSQL Pool with host:", host ? "present" : "undefined", "user:", user ? "present" : "undefined");
  return new Pool({
    host,
    user,
    password,
    database,
    connectionTimeoutMillis: 15000,
    idleTimeoutMillis: 10000, // Close idle clients after 10 seconds to prevent stale idle connections
    max: 20,                  // Allow more concurrent connections
    keepAlive: true,          // Enable TCP keep-alive
    keepAliveInitialDelayMillis: 5000, // Send keep-alive packets after 5 seconds of inactivity
  });
};

export const pool = createPool();

pool.on('error', (err) => {
  console.error('Unexpected error on idle SQL pool client:', err);
});

export const db = drizzle(pool, { schema });

/**
 * Executes a database operation with retries on connection failures.
 * Perfect for serverless/Cloud SQL environments where connection drops can occur.
 */
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  retries = 4,
  delay = 1000
): Promise<T> {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      const errorMsg = error?.message || String(error);
      const causeMsg = error?.cause?.message || (error?.cause ? String(error.cause) : "");
      const fullErrorMsg = `${errorMsg} ${causeMsg}`.toLowerCase();

      const isConnectionError = 
        fullErrorMsg.includes("terminated unexpectedly") ||
        fullErrorMsg.includes("connection") ||
        fullErrorMsg.includes("timeout") ||
        fullErrorMsg.includes("pool") ||
        fullErrorMsg.includes("client") ||
        fullErrorMsg.includes("socket") ||
        error?.code === "ECONNRESET" ||
        error?.code === "ETIMEDOUT" ||
        error?.cause?.code === "ECONNRESET" ||
        error?.cause?.code === "ETIMEDOUT";

      if (isConnectionError && i < retries - 1) {
        console.log(`[DB Pool] Transient connection interruption, re-attempting query in ${delay}ms (attempt ${i + 1}/${retries}).`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 1.5; // exponential backoff
      } else {
        throw error;
      }
    }
  }
  throw lastError;
}
