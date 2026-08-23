import { z } from 'zod';
import { TaskPriorityValues } from '@task-board/shared';
import { uuid, nonEmptyString, optionalString } from '../validators/common.js';

/**
 * Schema for creating a new task.
 */
export const CreateTaskSchema = z.object({
  typeId: uuid(),
  title: nonEmptyString(255, 'Task title'),
  description: optionalString(10000),
  statusId: uuid(),
  priority: z.enum(TaskPriorityValues),
  assigneeId: uuid().optional(),
  sprintId: uuid().optional(),
  labelIds: z.array(uuid()).optional(),
});

/**
 * Schema for updating an existing task.
 * Version is required for optimistic concurrency.
 */
export const UpdateTaskSchema = z.object({
  title: nonEmptyString(255, 'Task title').optional(),
  description: optionalString(10000),
  statusId: uuid().optional(),
  priority: z.enum(TaskPriorityValues).optional(),
  assigneeId: uuid().nullable().optional(),
  typeId: uuid().optional(),
  sprintId: uuid().nullable().optional(),
  labelIds: z.array(uuid()).optional(),
  version: z.number().int().positive(),
});

/**
 * Schema for task query parameters.
 */
export const TaskQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  sort: z.string().optional(),
  search: z.string().optional(),
  statusId: uuid().optional(),
  priority: z.enum(TaskPriorityValues).optional(),
  typeId: uuid().optional(),
  assigneeId: uuid().optional(),
  reporterId: uuid().optional(),
  sprintId: uuid().optional(),
  labelId: uuid().optional(),
});
