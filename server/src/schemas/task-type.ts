import * as z from 'zod';
import { nonEmptyString, uuid } from '../validators/common.js';

/**
 * Schema for creating a new task type.
 */
export const CreateTaskTypeSchema = z.object({
  key: z
    .string()
    .min(1, 'Key cannot be empty')
    .max(20, 'Key must be at most 20 characters')
    .regex(
      /^[A-Z][A-Z0-9_]*$/,
      'Key must start with a letter and contain only uppercase letters, digits, and underscores',
    ),
  name: nonEmptyString(100, 'Task type name'),
  icon: z.string().max(50).default('📋'),
  position: z.number().int().nonnegative(),
});

/**
 * Schema for updating an existing task type.
 * Key is immutable — not included in update schema.
 */
export const UpdateTaskTypeSchema = z.object({
  name: nonEmptyString(100, 'Task type name').optional(),
  icon: z.string().max(50).optional(),
  position: z.number().int().nonnegative().optional(),
});

/**
 * Schema for deleting a task type with optional replacement.
 */
export const DeleteTaskTypeSchema = z.object({
  replacementTypeId: uuid().optional(),
});

/**
 * Schema for reordering task types in bulk.
 */
export const ReorderTaskTypeSchema = z.object({
  items: z.array(z.object({ id: uuid(), position: z.number().int().nonnegative() })).min(1),
});
