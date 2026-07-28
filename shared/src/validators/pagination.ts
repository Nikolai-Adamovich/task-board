import { z } from 'zod';

/**
 * Validates common pagination query parameters.
 * - page: positive integer, defaults to 1
 * - limit: integer between 1 and 100, defaults to 20
 */
export const paginationQuery = () =>
  z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  });
