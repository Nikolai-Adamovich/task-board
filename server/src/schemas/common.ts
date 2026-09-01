import * as z from 'zod';

/**
 * Standard error response schema per v5 spec §7.3.
 * All API errors return this shape wrapped in `{ error: { ... } }`.
 */
export const ErrorResponseSchema = z.object({
  /** Machine-readable error code (e.g., "VALIDATION_ERROR", "NOT_FOUND") */
  code: z.string(),
  /** Human-readable error message */
  message: z.string(),
  /** Optional additional error details (field-level validation errors, etc.) */
  details: z.unknown().optional(),
});

/**
 * Wrapped error response matching the v5 structured error model.
 */
export const WrappedErrorResponseSchema = z.object({
  error: ErrorResponseSchema,
});

/**
 * Pagination query parameters accepted by list endpoints.
 * Per v5 spec: page >= 1, limit 1–100, sort format field:direction.
 */
export const PaginationQuerySchema = z.object({
  /** 1-based page number */
  page: z.coerce.number().int().min(1).default(1),
  /** Number of items per page (1-100) */
  limit: z.coerce.number().int().min(1).max(100).default(30),
  /** Sort field and direction (e.g., "createdAt:desc") */
  sort: z
    .string()
    .regex(/^[a-zA-Z_][a-zA-Z0-9_.]*:(asc|desc)$/)
    .default('createdAt:desc'),
});

/**
 * Pagination metadata included in paginated responses.
 */
export const PaginationMetaSchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

/**
 * Generic paginated response wrapper.
 * Factory function that creates a paginated response schema for any item schema.
 *
 * Response shape: `{ data: T[], pagination: { page, limit, total, totalPages } }`
 */
export function createPaginatedResponseSchema<T extends z.ZodType>(itemSchema: T) {
  return z.object({
    /** Array of items for the current page */
    data: z.array(itemSchema),
    /** Pagination metadata */
    pagination: PaginationMetaSchema,
  });
}

/**
 * Common list query parameters combining pagination with search.
 */
export const ListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  sort: z
    .string()
    .regex(/^[a-zA-Z_][a-zA-Z0-9_.]*:(asc|desc)$/)
    .default('createdAt:desc'),
  /** Optional search/filter string */
  search: z.string().optional(),
});
