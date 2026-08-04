import { z } from 'zod';

/**
 * Standard error response returned by API endpoints on failure.
 * Used by all contract definitions as the error response shape.
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
 * Pagination query parameters accepted by list endpoints.
 */
export const PaginationSchema = z.object({
  /** 1-based page number */
  page: z.number().int().positive().default(1),
  /** Number of items per page (1-100) */
  limit: z.number().int().min(1).max(100).default(20),
});

/**
 * Generic paginated response wrapper.
 * Provides a factory function that creates a paginated response schema
 * for any given item schema.
 */
export function createPaginatedResponseSchema<T extends z.ZodType>(itemSchema: T) {
  return z.object({
    /** Array of items for the current page */
    data: z.array(itemSchema),
    /** Total number of items across all pages */
    total: z.number().int().nonnegative(),
    /** Current page number */
    page: z.number().int().positive(),
    /** Items per page */
    limit: z.number().int().positive(),
  });
}

/**
 * Common list query parameters combining pagination with search.
 */
export const ListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  /** Optional search/filter string */
  search: z.string().optional(),
});
