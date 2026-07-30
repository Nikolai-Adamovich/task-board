import { slug as commonSlug } from './common.js';

/**
 * Validates that a string is a URL-friendly slug.
 * Rules: lowercase letters, numbers, and hyphens only.
 * Must start and end with an alphanumeric character.
 * Minimum 2 characters, maximum 80.
 */
export const slug = commonSlug;
