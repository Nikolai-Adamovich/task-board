import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { z } from 'zod';
import {
  errorHandler,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  ConflictError,
  AppError,
} from './error-handler.js';

/** Helper to extract the `error` object from a JSON response. */
async function errorBody(res: Response) {
  const json = (await res.json()) as { error: { code: string; message: string; details?: unknown } };

  return json.error;
}

function createTestApp() {
  const app = new Hono();

  app.onError(errorHandler);

  app.get('/not-found', () => {
    throw new NotFoundError('User not found');
  });

  app.get('/unauthorized', () => {
    throw new UnauthorizedError('Token expired');
  });

  app.get('/forbidden', () => {
    throw new ForbiddenError('No access');
  });

  app.get('/validation', () => {
    throw new ValidationError('Invalid input', [{ field: 'email', message: 'Invalid email' }]);
  });

  app.get('/conflict', () => {
    throw new ConflictError('Already exists');
  });

  app.get('/conflict-specific', () => {
    throw new ConflictError('Task was modified', 'TASK_VERSION_CONFLICT');
  });

  app.get('/custom', () => {
    throw new AppError(403, 'PROJECT_ARCHIVED', 'Cannot modify archived project');
  });

  app.get('/zod-error', (c) => {
    const schema = z.object({ email: z.email() });
    const result = schema.safeParse({ email: 'bad' });

    if (!result.success) {
      throw result.error;
    }
    return c.json({ ok: true });
  });

  app.get('/unknown', () => {
    throw new Error('Something broke');
  });

  app.get('/ok', (c) => {
    return c.json({ success: true });
  });

  return app;
}

describe('errorHandler', () => {
  const app = createTestApp();

  it('passes through successful requests', async () => {
    const res = await app.request('/ok');

    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body).toEqual({ success: true });
  });

  it('returns 404 for NotFoundError', async () => {
    const res = await app.request('/not-found');

    expect(res.status).toBe(404);

    const err = await errorBody(res);

    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('User not found');
  });

  it('returns 401 for UnauthorizedError', async () => {
    const res = await app.request('/unauthorized');

    expect(res.status).toBe(401);

    const err = await errorBody(res);

    expect(err.code).toBe('UNAUTHORIZED');
    expect(err.message).toBe('Token expired');
  });

  it('returns 403 for ForbiddenError', async () => {
    const res = await app.request('/forbidden');

    expect(res.status).toBe(403);

    const err = await errorBody(res);

    expect(err.code).toBe('FORBIDDEN');
  });

  it('returns 400 for ValidationError with details', async () => {
    const res = await app.request('/validation');

    expect(res.status).toBe(400);

    const err = await errorBody(res);

    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.details).toEqual([{ field: 'email', message: 'Invalid email' }]);
  });

  it('returns 409 for ConflictError', async () => {
    const res = await app.request('/conflict');

    expect(res.status).toBe(409);

    const err = await errorBody(res);

    expect(err.code).toBe('CONFLICT');
  });

  it('returns 409 for specific conflict codes', async () => {
    const res = await app.request('/conflict-specific');

    expect(res.status).toBe(409);

    const err = await errorBody(res);

    expect(err.code).toBe('TASK_VERSION_CONFLICT');
  });

  it('returns custom status code and code for AppError', async () => {
    const res = await app.request('/custom');

    expect(res.status).toBe(403);

    const err = await errorBody(res);

    expect(err.code).toBe('PROJECT_ARCHIVED');
    expect(err.message).toBe('Cannot modify archived project');
  });

  it('returns 400 VALIDATION_ERROR for ZodError', async () => {
    const res = await app.request('/zod-error');

    expect(res.status).toBe(400);

    const err = await errorBody(res);

    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.message).toBe('Request validation failed');
    expect(Array.isArray(err.details)).toBe(true);
    expect((err.details as unknown[]).length).toBeGreaterThan(0);
  });

  it('returns 500 for unknown errors without leaking stack', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      const res = await app.request('/unknown');

      expect(res.status).toBe(500);

      const json = (await res.json()) as Record<string, unknown>;
      const err = json.error as Record<string, unknown>;

      expect(err.code).toBe('INTERNAL_ERROR');
      expect(err.message).toBe('An unexpected error occurred');
      expect(json).not.toHaveProperty('stack');
      expect(consoleSpy).toHaveBeenCalledOnce();
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it('all responses are wrapped in { error: { ... } }', async () => {
    const endpoints = ['/not-found', '/unauthorized', '/forbidden', '/validation', '/conflict', '/unknown'];
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      for (const endpoint of endpoints) {
        const res = await app.request(endpoint);
        const json = (await res.json()) as Record<string, unknown>;

        expect(json).toHaveProperty('error');
        expect(typeof json.error).toBe('object');
        expect(json.error).toHaveProperty('code');
        expect(json.error).toHaveProperty('message');
      }
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
