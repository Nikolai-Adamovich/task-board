import { createMiddleware } from 'hono/factory';
import { ValidationError } from './error-handler.js';
import type { AppEnv } from '../types/context.js';
import type { ZodType } from 'zod';

// ─── Validation Middleware Factory ────────────────────────────────────────────

/**
 * Factory function that creates a Hono middleware validating the request body
 * against a Zod schema.
 *
 * Uses `schema.safeParse()` (Zod 4) for validation.
 * On failure, returns 422 with structured validation error details.
 * On success, the parsed data is set as `c.get('validatedBody')`.
 *
 * @param schema - A Zod schema to validate the request body against
 * @returns Hono middleware that validates and parses the request body
 *
 * @example
 * ```ts
 * import { RegisterRequestSchema } from '@task-board/shared';
 *
 * app.post('/auth/register', validateBody(RegisterRequestSchema), handler);
 * ```
 */
export function validateBody<T extends ZodType>(schema: T) {
  return createMiddleware<AppEnv>(async (c, next) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw new ValidationError('Invalid JSON in request body');
    }

    const result = schema.safeParse(body);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      }));

      throw new ValidationError('Request body validation failed', details);
    }

    // Store parsed data for the route handler to use
    c.set('validatedBody' as never, result.data as never);

    await next();
  });
}

/**
 * Factory function that creates a Hono middleware validating query parameters
 * against a Zod schema.
 *
 * @param schema - A Zod schema to validate query params against
 * @returns Hono middleware that validates and parses query parameters
 */
export function validateQuery<T extends ZodType>(schema: T) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const query = c.req.query();

    const result = schema.safeParse(query);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      }));

      throw new ValidationError('Query parameter validation failed', details);
    }

    c.set('validatedQuery' as never, result.data as never);

    await next();
  });
}
