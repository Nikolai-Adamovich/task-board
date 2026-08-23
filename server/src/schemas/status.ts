import { z } from 'zod';
import { nonEmptyString, uuid } from '../validators/common.js';

/**
 * Schema for creating a new status.
 */
export const CreateStatusSchema = z.object({
  name: nonEmptyString(100, 'Status name'),
  position: z.number().int().nonnegative(),
});

/**
 * Schema for updating an existing status.
 * All fields are optional (partial update).
 */
export const UpdateStatusSchema = z.object({
  name: nonEmptyString(100, 'Status name').optional(),
  position: z.number().int().nonnegative().optional(),
});

/**
 * Schema for deleting a status with optional replacement.
 */
export const DeleteStatusSchema = z.object({
  replacementStatusId: uuid().optional(),
});
