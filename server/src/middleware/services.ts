import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../types/context.js';
import { buildServices } from '../container.js';

/**
 * Builds the request-scoped service graph and exposes it via `c.get('svc')`.
 *
 * Must run after the MongoDB connection middleware (index.ts) so that
 * `getCollection()` resolves within the request's AsyncLocalStorage context.
 *
 * @example
 * ```ts
 * const { tasks } = c.get('svc');
 * const task = await tasks.getTask(id);
 * ```
 */
export const provideServices = createMiddleware<AppEnv>(async (c, next) => {
  c.set('svc', buildServices(c.env));
  await next();
});
