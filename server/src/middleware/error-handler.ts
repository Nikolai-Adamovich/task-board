import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { ErrorHandler } from 'hono';

// ─── Custom Error Classes ────────────────────────────────────────────────────

export class AppError extends HTTPException {
  public readonly appCode: string;
  public readonly details?: unknown;

  constructor(statusCode: ContentfulStatusCode, code: string, message: string, details?: unknown) {
    super(statusCode, { message });
    this.appCode = code;
    this.details = details;
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(404, 'NOT_FOUND', message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(403, 'FORBIDDEN', message);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: unknown) {
    super(422, 'VALIDATION_ERROR', message, details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(409, 'CONFLICT', message);
  }
}

// ─── Error Handler ────────────────────────────────────────────────────────────

/**
 * Global error handler for Hono apps.
 *
 * Catches unhandled errors and returns standardized JSON responses:
 * `{ code, message, details? }`
 *
 * Known AppError subclasses map to their respective HTTP status codes.
 * Unknown errors return 500 without leaking stack traces in production.
 *
 * Use with `app.onError(errorHandler)` in the Hono app bootstrap.
 */
export const errorHandler: ErrorHandler = (err, c) => {
  // Handle known application errors (HTTPException subclasses)
  if (err instanceof AppError) {
    return c.json(
      {
        code: err.appCode,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
      err.status,
    );
  }

  // Handle Hono's built-in HTTPException (404, method not allowed, etc.)
  if (err instanceof HTTPException) {
    return c.json(
      {
        code: 'HTTP_ERROR',
        message: err.message,
      },
      err.status,
    );
  }

  // Handle unknown errors — do not leak internals
  console.error('Unhandled error:', err);

  return c.json(
    {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    },
    500,
  );
};
