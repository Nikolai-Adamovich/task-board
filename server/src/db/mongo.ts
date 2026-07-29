import type { Collection, Db, MongoClient } from 'mongodb';

let db: Db | null = null;

/**
 * Initialize and return the MongoDB client.
 *
 * In Cloudflare Workers the TCP socket does not survive between requests,
 * so a cached MongoClient becomes stale immediately.  This function creates
 * a **fresh connection on every request** which, for a local MongoDB, takes
 * only a few milliseconds — far less than the 10-second socket-timeout that
 * was previously hit when the driver tried to reuse a dead socket.
 *
 * A `db` module-level variable is kept so that `getDb()` / `getCollection()`
 * can still be called by downstream code without passing the client through.
 *
 * @param uri - MongoDB connection string from environment variables
 * @returns The connected MongoClient instance
 */
export async function connectMongo(uri: string): Promise<MongoClient> {
  // Dynamic import required — MongoDB's BSON module calls crypto.randomBytes()
  // at module load time, which Cloudflare Workers forbids at global scope.
  const { MongoClient } = await import('mongodb');
  const client = new MongoClient(uri, {
    maxPoolSize: 1,
    minPoolSize: 0,
    connectTimeoutMS: 5_000,
    serverSelectionTimeoutMS: 5_000,
  });

  await client.connect();
  db = client.db();
  return client;
}

/**
 * Get the active MongoDB database instance.
 * Throws if `connectMongo()` has not been called yet.
 */
export function getDb(): Db {
  if (!db) {
    throw new Error('MongoDB not connected. Call connectMongo() first.');
  }
  return db;
}

/**
 * Get a typed MongoDB collection.
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

/**
 * Reset the cached database reference.
 * Useful for testing — the client is now created per-request so there
 * is no long-lived connection to close.
 */
export function closeMongo(): void {
  db = null;
}
