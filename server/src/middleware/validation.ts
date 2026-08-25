import { zValidator } from '@hono/zod-validator';
import type { ZodType } from 'zod';
import { ValidationError } from './error-handler.js';

// ─── Validation Middleware (built on @hono/zod-validator) ────────────────────

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

const TARGET_MESSAGES = {
  json: 'Request body validation failed',
  query: 'Query parameter validation failed',
  param: 'Path parameter validation failed',
} as const;

/**
 * Typed request validation built on the official `@hono/zod-validator`.
 *
 * On success the parsed data is available in the handler via
 * `c.req.valid(target)` — fully typed from the schema, no casts needed.
 * On failure throws {@link ValidationError} → 400 VALIDATION_ERROR
 * (same response contract as the previous hand-rolled middleware).
 *
 * @example
 * ```ts
 * router.post('/projects/:projectId/tasks', validateBody(CreateTaskSchema), async (c) => {
 *   const body = c.req.valid('json'); // typed as z.infer<typeof CreateTaskSchema>
 * });
 * ```
 */
function validated<T extends ZodType>(target: keyof typeof TARGET_MESSAGES, schema: T) {
  return zValidator(target, schema, (result) => {
    if (!result.success) {
      throw new ValidationError(TARGET_MESSAGES[target], formatZodIssues(result.error.issues));
    }
  });
}

/** Validate and type the JSON request body against a Zod v4 schema. */
export function validateBody<T extends ZodType>(schema: T) {
  return validated('json', schema);
}

/** Validate and type the query parameters against a Zod v4 schema. */
export function validateQuery<T extends ZodType>(schema: T) {
  return validated('query', schema);
}

/** Validate and type the path parameters against a Zod v4 schema. */
export function validateParams<T extends ZodType>(schema: T) {
  return validated('param', schema);
}
