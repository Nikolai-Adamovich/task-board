import { uuid as commonUuid } from './common.js';

/**
 * Validates that a string is a valid UUID format.
 * Useful for path parameters like :id, :userId, etc.
 */
export const uuid = commonUuid;
