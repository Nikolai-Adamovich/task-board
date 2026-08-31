import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ClientSession, Db, MongoClient } from 'mongodb';
import {
  runWithDb,
  withTransaction,
  TransactionsUnsupportedError,
  getMongoClient,
  resetSharedClient,
  isIoContextError,
} from './mongo.js';

// ─── Fake runtime mongodb module (for the singleton experiment tests) ────────

const mongoMocks = vi.hoisted(() => ({
  connect: vi.fn(),
}));

vi.mock('mongodb', () => ({
  MongoClient: class FakeMongoClient {
    connect = mongoMocks.connect;
    db = vi.fn();
    on = vi.fn();
  },
}));

// ─── Fake Client / Session ───────────────────────────────────────────────────

/**
 * Minimal fake MongoClient. `topologyType` mirrors the driver's
 * `client.topology.description.type` values ('Single', 'ReplicaSetWithPrimary',
 * 'Sharded', …) which `withTransaction` uses for its up-front capability check.
 */
function createFakeClient(topologyType?: string, withTransactionImpl?: () => Promise<never>) {
  const defaultWithTransaction = async (fn: (session: ClientSession) => Promise<unknown>): Promise<unknown> =>
    fn(session as unknown as ClientSession);
  const session: {
    withTransaction: ReturnType<typeof vi.fn>;
    endSession: ReturnType<typeof vi.fn>;
  } = {
    withTransaction: vi.fn(withTransactionImpl ?? defaultWithTransaction),
    endSession: vi.fn(async (): Promise<void> => undefined),
  };
  const client = {
    topology: topologyType === undefined ? undefined : { description: { type: topologyType } },
    startSession: vi.fn(() => session),
  };

  return { client: client as unknown as MongoClient, session };
}

function runInDbContext<T>(client: MongoClient, fn: () => Promise<T>): Promise<T> {
  return runWithDb({ client } as unknown as Db, fn);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('withTransaction', () => {
  it('runs the callback inside a session and returns its result on a replica set', async () => {
    const { client, session } = createFakeClient('ReplicaSetWithPrimary');
    const result = await runInDbContext(client, () =>
      withTransaction(async (txSession) => {
        expect(txSession).toBe(session);
        return 'seeded';
      }),
    );

    expect(result).toBe('seeded');
    expect(client.startSession).toHaveBeenCalledTimes(1);
    expect(session.withTransaction).toHaveBeenCalledTimes(1);
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });

  it('throws TransactionsUnsupportedError up-front for a standalone topology', async () => {
    const { client, session } = createFakeClient('Single');

    await expect(runInDbContext(client, () => withTransaction(async () => 'never'))).rejects.toThrow(
      TransactionsUnsupportedError,
    );

    // No session is even started — the check happens before any command
    expect(client.startSession).not.toHaveBeenCalled();
    expect(session.endSession).not.toHaveBeenCalled();
  });

  it('normalizes runtime "transactions not supported" errors into TransactionsUnsupportedError', async () => {
    const { client, session } = createFakeClient('ReplicaSetNoPrimary', async () => {
      throw new Error('Transaction numbers are only allowed on a replica set member or mongos');
    });

    await expect(runInDbContext(client, () => withTransaction(async () => 'never'))).rejects.toThrow(
      TransactionsUnsupportedError,
    );

    expect(session.endSession).toHaveBeenCalledTimes(1); // session still cleaned up
  });

  it('rethrows unrelated errors untouched and still ends the session', async () => {
    const failure = new Error('duplicate key');
    const { client, session } = createFakeClient('Sharded', async () => {
      throw failure;
    });

    await expect(runInDbContext(client, () => withTransaction(async () => 'never'))).rejects.toBe(failure);

    expect(session.endSession).toHaveBeenCalledTimes(1);
  });

  it('assumes transaction support when no topology description is available', async () => {
    const { client } = createFakeClient(undefined);
    const result = await runInDbContext(client, () => withTransaction(async () => 'ok'));

    expect(result).toBe('ok');
  });
});

describe('getMongoClient — singleton experiment', () => {
  beforeEach(() => {
    resetSharedClient();
    mongoMocks.connect.mockReset();
    mongoMocks.connect.mockResolvedValue(undefined);
  });

  it('reuses ONE client across concurrent calls (a single connect)', async () => {
    const [a, b, c] = await Promise.all([
      getMongoClient('mongodb://localhost:1/db'),
      getMongoClient('mongodb://localhost:1/db'),
      getMongoClient('mongodb://localhost:1/db'),
    ]);

    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(mongoMocks.connect).toHaveBeenCalledTimes(1);
  });

  it('does not cache a failed connect — the next call retries', async () => {
    mongoMocks.connect.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(undefined);

    await expect(getMongoClient('mongodb://localhost:1/db')).rejects.toThrow('boom');

    const second = await getMongoClient('mongodb://localhost:1/db');

    expect(second).toBeDefined();
    expect(mongoMocks.connect).toHaveBeenCalledTimes(2);
  });

  it('per-request mode creates a fresh client on every call', async () => {
    const a = await getMongoClient('mongodb://localhost:1/db', 'per-request');
    const b = await getMongoClient('mongodb://localhost:1/db', 'per-request');

    expect(a).not.toBe(b);
    expect(mongoMocks.connect).toHaveBeenCalledTimes(2);
  });
});

describe('isIoContextError', () => {
  it('matches workerd I/O-context failures', () => {
    expect(isIoContextError(new Error('Cannot perform I/O on behalf of a different request'))).toBe(true);
    expect(isIoContextError(new Error('A hanging Promise was canceled. ...'))).toBe(true);
  });

  it('does not match ordinary MongoDB or network errors', () => {
    expect(isIoContextError(new Error('MongoServerSelectionError: connection refused'))).toBe(false);
    expect(isIoContextError(new Error('topology was destroyed'))).toBe(false);
    expect(isIoContextError('plain string error')).toBe(false);
  });
});
