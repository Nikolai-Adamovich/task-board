import { z } from 'zod';

/**
 * Validates that a string is a URL-friendly slug.
 * Rules: lowercase letters, numbers, and hyphens only.
 * Must start and end with an alphanumeric character.
 * Minimum 2 characters, maximum 80.
 */
export const slug = () =>
  z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(80, 'Slug must be at most 80 characters')
    .regex(
      /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
      'Slug must contain only lowercase letters, numbers, and hyphens, and must start/end with an alphanumeric character',
    );
