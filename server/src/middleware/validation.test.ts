import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { z } from 'zod';
import { validateBody, validateQuery, validateParams } from './validation.js';
import { errorHandler } from './error-handler.js';
import type { AppEnv } from '../types/context.js';

const TestBodySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
});
const TestQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  search: z.string().optional(),
});

describe('validateBody middleware', () => {
  function createTestApp() {
    const app = new Hono<AppEnv>();

    app.onError(errorHandler);
    app.post('/test', validateBody(TestBodySchema), (c) => {
      return c.json({ success: true });
    });
    return app;
  }

  const app = createTestApp();

  it('returns 400 when body is invalid JSON', async () => {
    const res = await app.request('/test', {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(400);

    const json = (await res.json()) as { error: { code: string } };

    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 with details when validation fails', async () => {
    const res = await app.request('/test', {
      method: 'POST',
      body: JSON.stringify({ name: '', email: 'bad-email' }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(400);

    const json = (await res.json()) as { error: { code: string; details: unknown[] } };

    expect(json.error.code).toBe('VALIDATION_ERROR');
    expect(json.error.details).toBeDefined();
    expect(Array.isArray(json.error.details)).toBe(true);
    expect(json.error.details.length).toBeGreaterThan(0);
  });

  it('passes through when body is valid', async () => {
    const res = await app.request('/test', {
      method: 'POST',
      body: JSON.stringify({ name: 'John', email: 'john@example.com' }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
  });
});

describe('validateQuery middleware', () => {
  function createTestApp() {
    const app = new Hono<AppEnv>();

    app.onError(errorHandler);
    app.get('/test', validateQuery(TestQuerySchema), (c) => {
      return c.json({ success: true });
    });
    return app;
  }

  const app = createTestApp();

  it('returns 400 when query params are invalid', async () => {
    const res = await app.request('/test?page=-1');

    expect(res.status).toBe(400);

    const json = (await res.json()) as { error: { code: string } };

    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('passes through when query params are valid', async () => {
    const res = await app.request('/test?page=2&search=test');

    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
  });

  it('applies defaults for missing optional params', async () => {
    const res = await app.request('/test');

    expect(res.status).toBe(200);
  });
});

describe('validateParams middleware', () => {
  function createTestApp() {
    const app = new Hono<AppEnv>();

    app.onError(errorHandler);
    app.get('/test/:id', validateParams(z.object({ id: z.string().min(1) })), (c) => {
      return c.json({ success: true });
    });
    return app;
  }

  const app = createTestApp();

  it('passes through when params are valid', async () => {
    const res = await app.request('/test/abc123');

    expect(res.status).toBe(200);
  });
});
