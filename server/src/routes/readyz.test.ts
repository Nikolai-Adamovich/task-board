import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db, MongoClient } from 'mongodb';
import { connectMongo } from '../db/mongo.js';
import { createReadyzRoutes, pingDatabase, READY_PING_TIMEOUT_MS } from './readyz.js';

vi.mock('../db/mongo.js', () => ({
  connectMongo: vi.fn(),
}));

const ENV = { MONGODB_URI: 'mongodb://localhost:27017/test', JWT_SECRET: 'secret' };

function createApp() {
  return createReadyzRoutes();
}

function mockConnect(command: ReturnType<typeof vi.fn>) {
  vi.mocked(connectMongo).mockResolvedValue({
    client: { close: vi.fn().mockResolvedValue(undefined) } as unknown as MongoClient,
    db: { command } as unknown as Db,
  });
}

describe('GET /api/readyz', () => {
  beforeEach(() => {
    vi.mocked(connectMongo).mockReset();
  });

  it('returns 200 { status: "ok" } when the database answers the ping', async () => {
    mockConnect(vi.fn().mockResolvedValue({ ok: 1 }));

    const res = await createApp().request('/readyz', undefined, ENV);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
    expect(connectMongo).toHaveBeenCalledWith(ENV.MONGODB_URI);
  });

  it('returns 503 DB_UNAVAILABLE when the ping fails', async () => {
    mockConnect(vi.fn().mockRejectedValue(new Error('connection refused')));

    const res = await createApp().request('/readyz', undefined, ENV);

    expect(res.status).toBe(503);

    const body = (await res.json()) as { error: { code: string; message: string } };

    expect(body.error.code).toBe('DB_UNAVAILABLE');
  });

  it('returns 503 and never connects when MONGODB_URI is empty', async () => {
    const res = await createApp().request('/readyz', undefined, { ...ENV, MONGODB_URI: '' });

    expect(res.status).toBe(503);

    const body = (await res.json()) as { error: { code: string } };

    expect(body.error.code).toBe('DB_UNAVAILABLE');
    expect(connectMongo).not.toHaveBeenCalled();
  });

  it('closes the client after pinging', async () => {
    const close = vi.fn().mockResolvedValue(undefined);

    vi.mocked(connectMongo).mockResolvedValue({
      client: { close } as unknown as MongoClient,
      db: { command: vi.fn().mockResolvedValue({ ok: 1 }) } as unknown as Db,
    });

    await createApp().request('/readyz', undefined, ENV);

    expect(close).toHaveBeenCalledTimes(1);
  });
});

describe('pingDatabase', () => {
  it('resolves when the command resolves', async () => {
    const db = { command: vi.fn().mockResolvedValue({ ok: 1 }) } as unknown as Db;

    await expect(pingDatabase(db, 100)).resolves.toBeUndefined();
  });

  it('rejects when the ping exceeds the timeout', async () => {
    const db = { command: vi.fn().mockReturnValue(new Promise(() => undefined)) } as unknown as Db;

    await expect(pingDatabase(db, 10)).rejects.toThrow('timed out');
  });

  it('uses a short default timeout', () => {
    expect(READY_PING_TIMEOUT_MS).toBeLessThanOrEqual(5_000);
  });
});
