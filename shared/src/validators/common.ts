import { z } from 'zod';

/**
 * Validates that a string is a valid UUID v4.
 */
export const uuid = () => z.uuid('Invalid UUID format');

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

/**
 * Validates a non-empty string with a maximum length.
 */
export const nonEmptyString = (maxLength: number, fieldName = 'Field') =>
  z
    .string()
    .min(1, `${fieldName} cannot be empty`)
    .max(maxLength, `${fieldName} must be at most ${maxLength} characters`);

/**
 * Validates an optional string with a maximum length.
 */
export const optionalString = (maxLength: number) => z.string().max(maxLength).optional();

/**
 * Validates a nullable optional string with a maximum length.
 */
export const nullableOptionalString = (maxLength: number) => z.string().max(maxLength).nullable().optional();

/**
 * Validates an email address.
 */
export const email = () => z.email({ message: 'Invalid email address', pattern: z.regexes.html5Email });

/**
 * Validates an ISO 8601 datetime string.
 */
export const isoDateTime = () => z.iso.datetime();

/**
 * Validates a nullable ISO 8601 datetime string.
 */
export const nullableIsoDateTime = () => z.iso.datetime().nullable();

/**
 * Validates a non-negative integer.
 */
export const nonNegativeInt = () => z.number().int().nonnegative();

/**
 * Validates a string array of UUIDs.
 */
export const uuidArray = () => z.array(uuid());
