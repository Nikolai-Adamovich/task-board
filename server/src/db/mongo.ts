import { AsyncLocalStorage } from 'node:async_hooks';
import type { Collection, Db, MongoClient } from 'mongodb';

/**
 * Per-request MongoDB storage.
 *
 * In Cloudflare Workers TCP sockets do not survive between requests, so a
 * cached `MongoClient` becomes stale immediately.  The correct pattern is to
 * create a **new `MongoClient` per request** and close it when the response
 * is sent.
 *
 * `AsyncLocalStorage` makes the per-request `Db` instance available to all
 * downstream code (`getDb()`, `getCollection()`) without threading it through
 * every function parameter.
 */
const dbStorage = new AsyncLocalStorage<Db>();

/**
 * Create a fresh `MongoClient`, connect it, and return both the client and
 * its `Db` handle.  The caller is responsible for closing the client when
 * the request is done.
 */
export async function connectMongo(uri: string): Promise<{ client: MongoClient; db: Db }> {
  // Dynamic import required — MongoDB's BSON module calls crypto.randomBytes()
  // at module load time, which Cloudflare Workers forbids at global scope.
  const { MongoClient: MC } = await import('mongodb');
  const client = new MC(uri, {
    maxPoolSize: 1,
    minPoolSize: 0,
    connectTimeoutMS: 5_000,
    serverSelectionTimeoutMS: 5_000,
  });

  await client.connect();
  return { client, db: client.db() };
}

/**
 * Run a function within a per-request MongoDB context.
 *
 * Call this from the middleware so that `getDb()` / `getCollection()` resolve
 * to the correct `Db` instance for the current request, even when multiple
 * requests are in flight concurrently.
 */
export function runWithDb<T>(db: Db, fn: () => Promise<T>): Promise<T> {
  return dbStorage.run(db, fn);
}

/**
 * Get the active MongoDB database instance for the current request.
 * Throws if called outside a `runWithDb()` context.
 */
export function getDb(): Db {
  const db = dbStorage.getStore();

  if (!db) {
    throw new Error('MongoDB not connected. Ensure the MongoDB middleware is active.');
  }
  return db;
}

/**
 * Get a typed MongoDB collection from the current request's database.
 * This is the primary way to access collections throughout the application.
 *
 * @param name - The collection name
 * @returns A typed Collection reference
 *
 * @example
 * ```ts
 * const users = getCollection<UserDocument>('users');
 * const user = await users.findOne({ email: 'test@example.com' });
 * ```
 */
export function getCollection<T extends import('mongodb').Document>(name: string): Collection<T> {
  return getDb().collection<T>(name);
}
