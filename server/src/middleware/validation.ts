import { createMiddleware } from 'hono/factory';
import { ValidationError } from './error-handler.js';
import type { AppEnv } from '../types/context.js';
import type { ZodType } from 'zod';

// ─── Validation Middleware Factory ────────────────────────────────────────────

/** Zod v4 issue shape — path uses PropertyKey[] (includes symbol). */
interface ZodIssueLike {
  path: PropertyKey[];
  message: string;
  code: string;
}

/**
 * Format Zod v4 issues into structured validation error details.
 * Zod v4 uses PropertyKey[] for path (includes symbol), so we stringify safely.
 */
function formatZodIssues(issues: ZodIssueLike[]) {
  return issues.map((issue) => ({
    path: issue.path.map(String).join('.'),
    message: issue.message,
    code: issue.code,
  }));
}

/**
 * Factory function that creates a Hono middleware validating the request body
 * against a Zod v4 schema.
 *
 * Uses `schema.safeParse()` for validation.
 * On failure, returns 400 with structured VALIDATION_ERROR.
 * On success, the parsed data is set as `c.get('validatedBody')`.
 *
 * @param schema - A Zod schema to validate the request body against
 * @returns Hono middleware that validates and parses the request body
 *
 * @example
 * ```ts
 * import { RegisterRequestSchema } from '../schemas/auth.js';
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
      throw new ValidationError('Request body validation failed', formatZodIssues(result.error.issues));
    }

    // Store parsed data for the route handler to use
    c.set('validatedBody' as never, result.data as never);

    await next();
  });
}

/**
 * Factory function that creates a Hono middleware validating query parameters
 * against a Zod v4 schema.
 *
 * @param schema - A Zod schema to validate query params against
 * @returns Hono middleware that validates and parses query parameters
 */
export function validateQuery<T extends ZodType>(schema: T) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const query = c.req.query();
    const result = schema.safeParse(query);

    if (!result.success) {
      throw new ValidationError('Query parameter validation failed', formatZodIssues(result.error.issues));
    }

    c.set('validatedQuery' as never, result.data as never);

    await next();
  });
}

/**
 * Factory function that creates a Hono middleware validating path parameters
 * against a Zod v4 schema.
 *
 * @param schema - A Zod schema to validate path params against
 * @returns Hono middleware that validates and parses path parameters
 */
export function validateParams<T extends ZodType>(schema: T) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const params = c.req.param();
    const result = schema.safeParse(params);

    if (!result.success) {
      throw new ValidationError('Path parameter validation failed', formatZodIssues(result.error.issues));
    }

    c.set('validatedParams' as never, result.data as never);

    await next();
  });
}
