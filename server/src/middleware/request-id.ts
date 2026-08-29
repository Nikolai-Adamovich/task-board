import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types/context.js';

/**
 * Request-ID middleware (M-10).
 *
 * Assigns every request a correlation id:
 * - A well-formed incoming `X-Request-Id` header is trusted (lets callers /
 *   gateways propagate their own ids).
 * - Anything malformed — or no header — gets a fresh `crypto.randomUUID()`.
 *
 * The id is stored as `c.get('requestId')` (surfaced in the error envelope by
 * `errorHandler`) and echoed back on the response as `X-Request-Id`.
 *
 * Must be mounted FIRST in the middleware chain so every downstream log line
 * and error response can be correlated.
 */

const REQUEST_ID_HEADER = 'X-Request-Id';
/** UUID-ish: 8-4-4-4-12 hex digits (any version, case-insensitive). */
const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidRequestId(value: string | undefined): value is string {
  return value !== undefined && REQUEST_ID_PATTERN.test(value);
}

/** Trust a valid incoming id, otherwise generate one. Exported for tests. */
export function resolveRequestId(incoming: string | undefined): string {
  return isValidRequestId(incoming) ? incoming : crypto.randomUUID();
}

export const requestIdMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const requestId = resolveRequestId(c.req.header(REQUEST_ID_HEADER));

  c.set('requestId', requestId);
  // Set before `next()` so Hono merges it into whatever response the chain
  // produces — including error responses from `app.onError`.
  c.header(REQUEST_ID_HEADER, requestId);

  await next();
};
