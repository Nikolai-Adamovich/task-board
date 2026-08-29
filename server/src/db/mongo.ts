import { AsyncLocalStorage } from 'node:async_hooks';
import type { ClientSession, Collection, Db, MongoClient } from 'mongodb';

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

// ─── Transactions (DEC-025) ──────────────────────────────────────────────────

/**
 * Thrown when the connected MongoDB topology does not support multi-document
 * transactions (e.g. a standalone `mongod` without a replica set).
 *
 * Callers may catch this to fall back to a non-transactional code path —
 * see {@link withTransaction} and `ProjectService.createProject`.
 */
export class TransactionsUnsupportedError extends Error {
  constructor(message = 'This MongoDB deployment does not support transactions', options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'TransactionsUnsupportedError';
  }
}

/**
 * Minimal view of the driver-internal topology surface used by
 * {@link topologySupportsTransactions}. `client.topology` is not part of the
 * public `MongoClient` type in driver 7.x, so the introspection shape is
 * declared explicitly here; every field is optional and the check degrades to
 * `true` (see below) if the driver removes or reshapes it.
 */
interface TopologyIntrospection {
  topology?: { description?: { type?: string } };
}

/**
 * Best-effort topology check using the driver's public-ish surface.
 *
 * Transactions require a replica set (`ReplicaSetWithPrimary` /
 * `ReplicaSetNoPrimary`), sharded cluster (`Sharded`) or load balancer
 * (`LoadBalanced`). A `Single`/`Standalone`/`Unknown` topology cannot run
 * them. If the topology description is not reachable we return `true` and
 * rely on the runtime error detection in {@link isTransactionsUnsupportedError}
 * instead of blocking a potentially capable deployment.
 */
function topologySupportsTransactions(client: MongoClient): boolean {
  const topologyType = (client as TopologyIntrospection).topology?.description?.type;

  if (!topologyType) {
    return true;
  }

  return /ReplicaSet|Sharded|LoadBalanced/.test(topologyType);
}

/**
 * Detect the driver/server errors raised when a transaction is attempted
 * against a topology that does not support it. Known messages:
 * - "Transaction numbers are only allowed on a replica set member or mongos"
 * - "This MongoDB deployment does not support sessions/transactions" variants
 */
export function isTransactionsUnsupportedError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);

  return (
    /transaction/i.test(message) &&
    /(not supported|only allowed on a replica set|replica set member|mongos)/i.test(message)
  );
}

/**
 * Run `fn` inside a MongoDB multi-document transaction on the current
 * request's client (DEC-025). The session is committed automatically by the
 * driver's `withTransaction` retry wrapper; any error thrown by `fn` aborts
 * the transaction so **nothing becomes visible** (BR-003 atomic project seed).
 *
 * Must be called within a `runWithDb()` context — the underlying
 * `MongoClient` is taken from the request-scoped `Db`.
 *
 * @throws {@link TransactionsUnsupportedError} if the topology cannot run
 *   transactions (checked up-front via topology description, or detected at
 *   runtime from driver errors). Callers decide whether to fall back.
 *
 * @example
 * ```ts
 * await withTransaction(async (session) => {
 *   await collection.insertOne(doc, { session });
 * });
 * ```
 */
export async function withTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
  const db = getDb();
  const client = db.client;

  if (!topologySupportsTransactions(client)) {
    throw new TransactionsUnsupportedError();
  }

  const session = client.startSession();

  try {
    let result!: T;

    await session.withTransaction(async () => {
      result = await fn(session);
    });

    return result;
  } catch (err) {
    // Some drivers/servers only surface the unsupported-topology condition
    // when the first command actually runs — normalize it for callers.
    if (isTransactionsUnsupportedError(err)) {
      throw new TransactionsUnsupportedError(undefined, { cause: err });
    }

    throw err;
  } finally {
    await session.endSession().catch(() => {
      /* swallow — socket may already be dead */
    });
  }
}
