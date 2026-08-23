import type { ErrorHandler } from 'hono';
import { ZodError } from 'zod';

// Re-export error classes from the dedicated errors module.
// All existing imports from './error-handler.js' continue to work.
export {
  AppError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  ConflictError,
} from '../errors/app-error.js';

import { AppError } from '../errors/app-error.js';

// ─── Error Handler ────────────────────────────────────────────────────────────

/**
 * Global error handler for Hono apps.
 *
 * Returns structured JSON responses in the v5 format:
 * ```json
 * { "error": { "code": "...", "message": "...", "details": ... } }
 * ```
 *
 * Known error types:
 * - `AppError` (and subclasses) → mapped to their statusCode + code
 * - `ZodError` → 400 VALIDATION_ERROR with field-level details
 * - `HTTPException` (Hono built-in) → mapped to its status
 * - Unknown errors → 500 INTERNAL_ERROR (no stack leak)
 *
 * Use with `app.onError(errorHandler)` in the Hono app bootstrap.
 */
export const errorHandler: ErrorHandler = (err, c) => {
  // ── Known application errors ──────────────────────────────────────────────
  if (err instanceof AppError) {
    return c.json(
      {
        error: {
          code: err.code,
          message: err.message,
          ...(err.details !== undefined ? { details: err.details } : {}),
        },
      },
      err.statusCode as 400,
    );
  }

  // ── Zod validation errors ─────────────────────────────────────────────────
  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    }));

    return c.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details,
        },
      },
      400,
    );
  }

  // ── Hono built-in HTTPException (404, method not allowed, etc.) ───────────
  if ('status' in err && typeof err.status === 'number') {
    return c.json(
      {
        error: {
          code: 'HTTP_ERROR',
          message: err.message,
        },
      },
      err.status as 400,
    );
  }

  // ── Unknown errors — do not leak internals ────────────────────────────────
  console.error('Unhandled error:', err);

  return c.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    },
    500,
  );
};
