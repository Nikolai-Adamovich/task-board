import { describe, it, expect, vi } from 'vitest';
import type { ClientSession, Db, MongoClient } from 'mongodb';
import { runWithDb, withTransaction, TransactionsUnsupportedError, buildDirectConnectionUri } from './mongo.js';

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

describe('buildDirectConnectionUri', () => {
  it('rewrites an Atlas SRV URI to the deterministic shard host with direct params', () => {
    const uri = 'mongodb+srv://user:p%40ss@cluster0.abc123.mongodb.net/task-board?retryWrites=true&w=majority';

    expect(buildDirectConnectionUri(uri)).toBe(
      'mongodb://user:p%40ss@cluster0-shard-00-00.abc123.mongodb.net:27017/task-board' +
        '?retryWrites=true&w=majority&authSource=admin&tls=true&directConnection=true',
    );
  });

  it('adds authSource=admin only when the URI does not already carry one', () => {
    const uri = 'mongodb+srv://user:secret@cluster0.abc123.mongodb.net/?authSource=admin&x=1';
    const rewritten = buildDirectConnectionUri(uri);

    expect(rewritten).toContain('authSource=admin');
    expect(rewritten.match(/authSource=admin/g)).toHaveLength(1);
    expect(rewritten).toContain('x=1');
  });

  it('passes a non-SRV URI through untouched (multi-node seed lists need discovery)', () => {
    const uri = 'mongodb://user:secret@host1:27017,host2:27017/db?replicaSet=rs0';

    expect(buildDirectConnectionUri(uri)).toBe(uri);
  });

  it('handles an SRV URI without credentials', () => {
    const uri = 'mongodb+srv://cluster0.abc123.mongodb.net/db';

    expect(buildDirectConnectionUri(uri)).toBe(
      'mongodb://cluster0-shard-00-00.abc123.mongodb.net:27017/db?authSource=admin&tls=true&directConnection=true',
    );
  });
});
