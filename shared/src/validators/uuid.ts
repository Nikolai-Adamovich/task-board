import { z } from 'zod';

/**
 * Validates that a string is a valid UUID v4 format.
 * Useful for path parameters like :id, :userId, etc.
 */
export const uuid = () => z.string().uuid('Invalid UUID format');
