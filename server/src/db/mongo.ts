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
 * Rewrite an Atlas SRV URI (`mongodb+srv://`) into a direct single-host URI.
 *
 * Every request creates a fresh MongoClient (see module docstring), so the
 * driver repeats the full connection dance each time. With an SRV URI that
 * dance is especially expensive on Workers: two DNS-over-HTTPS lookups (SRV +
 * TXT) for topology discovery, then TCP + TLS + SCRAM against the discovered
 * host — measured at ~300 ms per request. `directConnection` skips discovery
 * entirely and connects straight to one known host.
 *
 * Atlas dedicated clusters (M0/M2/M5 — single-node replica sets) expose the
 * node at the deterministic `<cluster>-shard-00-00.<id>.mongodb.net:27017`
 * host, so the rewrite is safe: there is exactly one node and it is always
 * the primary. If the cluster is ever upgraded to a multi-node topology, the
 * MONGODB_URI secret should be switched to an explicit non-SRV seed list and
 * this rewrite becomes a no-op for it.
 *
 * SRV URIs imply `tls`, `authSource=admin` and `retryWrites=true`; a plain
 * URI does not, so the rewrite re-adds them explicitly.
 */
export function buildDirectConnectionUri(uri: string): string {
  const SRV_PREFIX = 'mongodb+srv://';

  if (!uri.startsWith(SRV_PREFIX)) {
    return uri; // already a seed-list URI — leave it untouched
  }

  // Parse via the WHATWG URL API (mongodb+srv is not a registered scheme, so
  // swap in http:// for parsing only — the result is an absolute URL, the
  // scheme itself is never used). username/password stay percent-encoded.
  const parsed = new URL(`http://${uri.slice(SRV_PREFIX.length)}`);
  const host = parsed.hostname; // e.g. cluster0.abc123.mongodb.net
  const dotIndex = host.indexOf('.');
  const cluster = dotIndex === -1 ? host : host.slice(0, dotIndex);
  const rest = dotIndex === -1 ? '' : host.slice(dotIndex); // ".abc123.mongodb.net"
  const directHost = `${cluster}-shard-00-00${rest}`;
  const params = parsed.searchParams;

  if (!params.has('authSource')) {
    params.set('authSource', 'admin');
  }
  params.set('tls', 'true');
  params.set('directConnection', 'true');

  const userinfo = parsed.username ? `${parsed.username}${parsed.password ? `:${parsed.password}` : ''}@` : '';

  return `mongodb://${userinfo}${directHost}:27017${parsed.pathname}?${params.toString()}`;
}

/**
 * Create a fresh `MongoClient`, connect it, and return both the client and
 * its `Db` handle.  The caller is responsible for closing the client when
 * the request is done.
 */
export async function connectMongo(uri: string): Promise<{ client: MongoClient; db: Db }> {
  // Dynamic import required — MongoDB's BSON module calls crypto.randomBytes()
  // at module load time, which Cloudflare Workers forbids at global scope.
  const { MongoClient: MC } = await import('mongodb');
  const directUri = buildDirectConnectionUri(uri);
  const client = new MC(directUri, {
    maxPoolSize: 1,
    minPoolSize: 0,
    connectTimeoutMS: 5_000,
    serverSelectionTimeoutMS: 5_000,
    // Only force direct topology when we rewrote an SRV URI ourselves; a
    // caller-provided non-SRV seed list may legitimately describe a
    // multi-node replica set that needs discovery.
    ...(directUri !== uri ? { directConnection: true } : {}),
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
