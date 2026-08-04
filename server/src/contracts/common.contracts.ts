import type { z } from 'zod';
import type { HttpMethod } from '@task-board/shared';
import { ErrorResponseSchema, createPaginatedResponseSchema } from '../schemas/common.js';

/**
 * Generic contract shape for API endpoints.
 * Describes the HTTP method, path, and request/response schemas.
 */
export interface ApiContract {
  /** HTTP method */
  method: HttpMethod;
  /** Relative path (appended to API_BASE_PATH) */
  path: string;
  /** Zod schema for the request body (undefined if no body) */
  body?: z.ZodType;
  /** Zod schema for query parameters (undefined if no query params) */
  query?: z.ZodType;
  /** Zod schema for a successful response */
  response: z.ZodType;
  /** Zod schema for error responses */
  error: typeof ErrorResponseSchema;
}

/** Standard error response schema used across all contracts */
export const errorResponse = ErrorResponseSchema;

/**
 * Factory for creating paginated response contracts.
 */
export { createPaginatedResponseSchema };
