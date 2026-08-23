import { z } from 'zod';

/**
 * Validates common pagination query parameters per v5 spec.
 * - page: positive integer, defaults to 1
 * - limit: integer between 1 and 100, defaults to 30
 * - sort: format `field:direction` (e.g., "createdAt:desc"), defaults to "createdAt:desc"
 */
export const paginationQuery = () =>
  z.object({
    page: z.coerce.number().int().min(1, 'Page must be >= 1').default(1),
    limit: z.coerce.number().int().min(1, 'Limit must be >= 1').max(100, 'Limit must be <= 100').default(30),
    sort: z
      .string()
      .regex(
        /^[a-zA-Z_][a-zA-Z0-9_.]*:(asc|desc)$/,
        'Sort must be in format "field:direction" (e.g., "createdAt:desc")',
      )
      .default('createdAt:desc'),
  });
