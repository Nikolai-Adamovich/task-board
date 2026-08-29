import { Hono } from 'hono';
import type { Db } from 'mongodb';
import { connectMongo } from '../db/mongo.js';
import type { AppEnv } from '../types/context.js';

/**
 * Readiness probe (N-20): `GET /api/readyz`.
 *
 * Unlike `/api/health` (liveness), this verifies the database is actually
 * reachable: it opens a **fresh** connection (Workers kill sockets between
 * requests, so a stale cached client would lie), pings it with a short
 * timeout, and closes the client.
 *
 * The route is mounted BEFORE the DB middleware on purpose — readiness must
 * not depend on migrations having succeeded, and it manages its own
 * short-lived client instead of the request-scoped Db context.
 *
 * Responses follow the standard envelope:
 * - 200 `{ status: 'ok' }`
 * - 503 `{ error: { code: 'DB_UNAVAILABLE', message } }` (empty URI, connect
 *   failure, ping failure or timeout)
 */

/** Upper bound for the ping — must be well under typical probe timeouts. */
export const READY_PING_TIMEOUT_MS = 2_000;

/** Ping the database, rejecting if it does not answer within `timeoutMs`. */
export async function pingDatabase(db: Db, timeoutMs: number = READY_PING_TIMEOUT_MS): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      db.command({ ping: 1 }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Database ping timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export function createReadyzRoutes(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.get('/readyz', async (c) => {
    const uri = c.env.MONGODB_URI;

    if (!uri) {
      return c.json(
        { error: { code: 'DB_UNAVAILABLE', message: 'Database is not configured (MONGODB_URI is empty)' } },
        503,
      );
    }

    try {
      const { client, db } = await connectMongo(uri);

      try {
        await pingDatabase(db);
      } finally {
        client.close().catch(() => {
          /* swallow — socket may already be dead */
        });
      }

      return c.json({ status: 'ok' });
    } catch {
      return c.json({ error: { code: 'DB_UNAVAILABLE', message: 'Database is not reachable' } }, 503);
    }
  });

  return app;
}
