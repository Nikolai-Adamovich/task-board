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
 * Q10 (RQ-04 ③): bulk update payload — exactly ONE field of `data` per request.
 * Nullable assigneeId/sprintId unassign/clear; absent fields stay untouched.
 */
export const BulkUpdateTasksSchema = z.object({
  taskIds: z.array(uuid()).min(1, 'At least one task id is required').max(100, 'At most 100 tasks per request'),
  data: z
    .object({
      statusId: uuid().optional(),
      assigneeId: uuid().nullable().optional(),
      sprintId: uuid().nullable().optional(),
    })
    .refine((data) => Object.values(data).filter((v) => v !== undefined).length === 1, {
      message: 'Exactly one of statusId, assigneeId or sprintId is required',
    }),
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
  /** Q13/F-01: inclusive ISO date-range filters */
  createdFrom: z.iso.date().optional(),
  createdTo: z.iso.date().optional(),
  updatedFrom: z.iso.date().optional(),
  updatedTo: z.iso.date().optional(),
});
