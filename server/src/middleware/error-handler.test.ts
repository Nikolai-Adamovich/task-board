import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import {
  errorHandler,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  ConflictError,
  AppError,
} from './error-handler.js';

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
    throw new ValidationError('Invalid input', { field: 'email' });
  });

  app.get('/conflict', () => {
    throw new ConflictError('Already exists');
  });

  app.get('/custom', () => {
    throw new AppError(503, 'SERVICE_UNAVAILABLE', 'Custom error');
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

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.code).toBe('NOT_FOUND');
    expect(body.message).toBe('User not found');
  });

  it('returns 401 for UnauthorizedError', async () => {
    const res = await app.request('/unauthorized');

    expect(res.status).toBe(401);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 for ForbiddenError', async () => {
    const res = await app.request('/forbidden');

    expect(res.status).toBe(403);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.code).toBe('FORBIDDEN');
  });

  it('returns 422 for ValidationError with details', async () => {
    const res = await app.request('/validation');

    expect(res.status).toBe(422);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.details).toEqual({ field: 'email' });
  });

  it('returns 409 for ConflictError', async () => {
    const res = await app.request('/conflict');

    expect(res.status).toBe(409);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.code).toBe('CONFLICT');
  });

  it('returns custom status code for AppError', async () => {
    const res = await app.request('/custom');

    expect(res.status).toBe(503);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('returns 500 for unknown errors without leaking stack', async () => {
    const res = await app.request('/unknown');

    expect(res.status).toBe(500);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.code).toBe('INTERNAL_SERVER_ERROR');
    expect(body.message).toBe('An unexpected error occurred');
    expect(body).not.toHaveProperty('stack');
  });
});
