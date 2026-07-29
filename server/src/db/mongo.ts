import type { Collection, Db, MongoClient } from 'mongodb';

let client: import('mongodb').MongoClient | null = null;
let db: Db | null = null;

/**
 * Initialize and return the MongoDB client singleton.
 * Reuses the existing connection if already established.
 *
 * Configured for Cloudflare Workers compatibility:
 * - `maxPoolSize: 1` avoids connection-pool stalls in the Workers runtime
 * - Timeouts ensure requests never hang indefinitely
 *
 * @param uri - MongoDB connection string from environment variables
 * @returns The connected MongoClient instance
 */
export async function connectMongo(uri: string): Promise<MongoClient> {
  if (client) {
    return client;
  }

  // Dynamic import required — MongoDB's BSON module calls crypto.randomBytes()
  // at module load time, which Cloudflare Workers forbids at global scope.
  const { MongoClient } = await import('mongodb');

  client = new MongoClient(uri, {
    maxPoolSize: 1,
    minPoolSize: 0,
    maxIdleTimeMS: 10_000,
    connectTimeoutMS: 10_000,
    socketTimeoutMS: 10_000,
    serverSelectionTimeoutMS: 10_000,
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
 * Close the MongoDB connection.
 * Useful for graceful shutdown or testing.
 */
export async function closeMongo(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}
