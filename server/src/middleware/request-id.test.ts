import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { requestIdMiddleware, resolveRequestId } from './request-id.js';
import type { AppEnv } from '../types/context.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_ID = '123e4567-e89b-12d3-a456-426614174000';

function createApp() {
  const app = new Hono<AppEnv>();

  app.use('*', requestIdMiddleware);
  app.get('/echo', (c) => c.json({ requestId: c.get('requestId') }));

  return app;
}

describe('requestIdMiddleware', () => {
  it('passes through a valid incoming X-Request-Id', async () => {
    const res = await createApp().request('/echo', { headers: { 'X-Request-Id': VALID_ID } });
    const body = (await res.json()) as { requestId: string };

    expect(res.headers.get('X-Request-Id')).toBe(VALID_ID);
    expect(body.requestId).toBe(VALID_ID);
  });

  it('generates a fresh UUID for a malformed header', async () => {
    const res = await createApp().request('/echo', { headers: { 'X-Request-Id': 'not-a-uuid' } });
    const body = (await res.json()) as { requestId: string };

    expect(body.requestId).not.toBe('not-a-uuid');
    expect(body.requestId).toMatch(UUID_PATTERN);
    expect(res.headers.get('X-Request-Id')).toBe(body.requestId);
  });

  it('generates a fresh UUID when the header is absent', async () => {
    const res = await createApp().request('/echo');
    const body = (await res.json()) as { requestId: string };

    expect(body.requestId).toMatch(UUID_PATTERN);
    expect(res.headers.get('X-Request-Id')).toBe(body.requestId);
  });

  it('generates different ids for different requests', async () => {
    const app = createApp();
    const first = ((await (await app.request('/echo')).json()) as { requestId: string }).requestId;
    const second = ((await (await app.request('/echo')).json()) as { requestId: string }).requestId;

    expect(first).not.toBe(second);
  });
});

describe('resolveRequestId', () => {
  it('trusts a valid UUID in any case', () => {
    expect(resolveRequestId(VALID_ID.toUpperCase())).toBe(VALID_ID.toUpperCase());
  });

  it('rejects malformed values and generates a UUID', () => {
    expect(resolveRequestId('../etc/passwd')).toMatch(UUID_PATTERN);
    expect(resolveRequestId(undefined)).toMatch(UUID_PATTERN);
  });
});
