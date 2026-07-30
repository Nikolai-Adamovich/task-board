import { z } from 'zod';
import { TaskPriority } from '../constants/roles.js';
import {
  uuid,
  nonEmptyString,
  optionalString,
  nullableOptionalString,
  isoDateTime,
  nonNegativeInt,
  uuidArray,
} from '../validators/common.js';

/**
 * Task entity schema.
 * The core work item in the task board. Tasks belong to a column within a board.
 */
export const TaskSchema = z.object({
  /** Unique task identifier (UUID v4) */
  id: uuid(),
  /** Owning tenant ID */
  tenantId: uuid(),
  /** Parent project ID */
  projectId: uuid(),
  /** Parent board ID */
  boardId: uuid(),
  /** Column the task is currently in */
  columnId: uuid(),
  /** Optional sprint assignment (null if in backlog) */
  sprintId: uuid().nullable(),
  /** Task title */
  title: nonEmptyString(200, 'Task title'),
  /** Optional detailed description (markdown) */
  description: nullableOptionalString(5000),
  /** User IDs assigned to this task */
  assigneeIds: uuidArray(),
  /** Task priority level */
  priority: z.enum(TaskPriority),
  /** Position/order within the column (for drag-and-drop) */
  position: nonNegativeInt(),
  /** User ID of the task creator */
  createdBy: uuid(),
  /** Creation timestamp (ISO 8601) */
  createdAt: isoDateTime(),
  /** Last update timestamp (ISO 8601) */
  updatedAt: isoDateTime(),
});

/** Inferred Task type */
export type Task = z.infer<typeof TaskSchema>;

/**
 * Schema for creating a new task.
 */
export const CreateTaskSchema = z.object({
  title: nonEmptyString(200, 'Task title'),
  description: optionalString(5000),
  projectId: uuid(),
  boardId: uuid(),
  columnId: uuid(),
  sprintId: uuid().optional(),
  priority: z.enum(TaskPriority).default('medium'),
  assigneeIds: uuidArray().default([]),
});

/** Inferred CreateTask type */
export type CreateTask = z.infer<typeof CreateTaskSchema>;

/**
 * Schema for updating an existing task.
 * All fields are optional (partial update).
 */
export const UpdateTaskSchema = z.object({
  title: nonEmptyString(200, 'Task title').optional(),
  description: optionalString(5000),
  priority: z.enum(TaskPriority).optional(),
  assigneeIds: uuidArray().optional(),
});

/** Inferred UpdateTask type */
export type UpdateTask = z.infer<typeof UpdateTaskSchema>;

/**
 * Schema for moving a task to a different column (and optionally a sprint).
 * Used for drag-and-drop operations on the board.
 */
export const MoveTaskSchema = z.object({
  taskId: uuid(),
  targetColumnId: uuid(),
  targetSprintId: uuid().optional(),
});

/** Inferred MoveTask type */
export type MoveTask = z.infer<typeof MoveTaskSchema>;

/**
 * Schema for assigning/unassigning users to a task.
 */
export const AssignTaskSchema = z.object({
  taskId: uuid(),
  assigneeIds: uuidArray(),
});

/** Inferred AssignTask type */
export type AssignTask = z.infer<typeof AssignTaskSchema>;

/**
 * Denormalized task schema for the cross-tenant "my tasks" view.
 * Contains contextual fields (tenant name, project name, column title)
 * so the dashboard can render without extra lookups.
 */
export const MyTaskSchema = z.object({
  /** Unique task identifier (UUID v4) */
  id: uuid(),
  /** Owning tenant ID */
  tenantId: uuid(),
  /** Tenant display name */
  tenantName: nonEmptyString(100, 'Tenant name'),
  /** Parent project ID */
  projectId: uuid(),
  /** Project display name */
  projectName: nonEmptyString(100, 'Project name'),
  /** Parent board ID */
  boardId: uuid(),
  /** Column the task is currently in */
  columnId: uuid(),
  /** Column display title */
  columnTitle: nonEmptyString(50, 'Column title'),
  /** Task title */
  title: nonEmptyString(200, 'Task title'),
  /** Optional detailed description */
  description: z.string().nullable(),
  /** Task priority level */
  priority: z.enum(TaskPriority),
  /** Optional sprint assignment (null if in backlog) */
  sprintId: uuid().nullable(),
  /** Creation timestamp (ISO 8601) */
  createdAt: isoDateTime(),
  /** Last update timestamp (ISO 8601) */
  updatedAt: isoDateTime(),
});

/** Inferred MyTask type */
export type MyTask = z.infer<typeof MyTaskSchema>;
