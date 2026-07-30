import { z } from 'zod';
import { TaskPriority } from '../constants/roles.js';

/**
 * Task entity schema.
 * The core work item in the task board. Tasks belong to a column within a board.
 */
export const TaskSchema = z.object({
  /** Unique task identifier (UUID v4) */
  id: z.uuid(),
  /** Owning tenant ID */
  tenantId: z.uuid(),
  /** Parent project ID */
  projectId: z.uuid(),
  /** Parent board ID */
  boardId: z.uuid(),
  /** Column the task is currently in */
  columnId: z.uuid(),
  /** Optional sprint assignment (null if in backlog) */
  sprintId: z.uuid().nullable(),
  /** Task title */
  title: z.string().min(1).max(200),
  /** Optional detailed description (markdown) */
  description: z.string().max(5000).nullable().optional(),
  /** User IDs assigned to this task */
  assigneeIds: z.array(z.uuid()),
  /** Task priority level */
  priority: z.enum(TaskPriority),
  /** Position/order within the column (for drag-and-drop) */
  position: z.number().nonnegative(),
  /** User ID of the task creator */
  createdBy: z.uuid(),
  /** Creation timestamp (ISO 8601) */
  createdAt: z.iso.datetime(),
  /** Last update timestamp (ISO 8601) */
  updatedAt: z.iso.datetime(),
});

/** Inferred Task type */
export type Task = z.infer<typeof TaskSchema>;

/**
 * Schema for creating a new task.
 */
export const CreateTaskSchema = z.object({
  title: z.string().min(1, 'Task title is required').max(200, 'Task title must be at most 200 characters'),
  description: z.string().max(5000).optional(),
  projectId: z.uuid('Invalid project ID'),
  boardId: z.uuid('Invalid board ID'),
  columnId: z.uuid('Invalid column ID'),
  sprintId: z.uuid('Invalid sprint ID').optional(),
  priority: z.enum(TaskPriority).default('medium'),
  assigneeIds: z.array(z.uuid()).default([]),
});

/** Inferred CreateTask type */
export type CreateTask = z.infer<typeof CreateTaskSchema>;

/**
 * Schema for updating an existing task.
 * All fields are optional (partial update).
 */
export const UpdateTaskSchema = z.object({
  title: z
    .string()
    .min(1, 'Task title cannot be empty')
    .max(200, 'Task title must be at most 200 characters')
    .optional(),
  description: z.string().max(5000).optional(),
  priority: z.enum(TaskPriority).optional(),
  assigneeIds: z.array(z.uuid()).optional(),
});

/** Inferred UpdateTask type */
export type UpdateTask = z.infer<typeof UpdateTaskSchema>;

/**
 * Schema for moving a task to a different column (and optionally a sprint).
 * Used for drag-and-drop operations on the board.
 */
export const MoveTaskSchema = z.object({
  taskId: z.uuid('Invalid task ID'),
  targetColumnId: z.uuid('Invalid target column ID'),
  targetSprintId: z.uuid('Invalid target sprint ID').optional(),
});

/** Inferred MoveTask type */
export type MoveTask = z.infer<typeof MoveTaskSchema>;

/**
 * Schema for assigning/unassigning users to a task.
 */
export const AssignTaskSchema = z.object({
  taskId: z.uuid('Invalid task ID'),
  assigneeIds: z.array(z.uuid()),
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
  id: z.uuid(),
  /** Owning tenant ID */
  tenantId: z.uuid(),
  /** Tenant display name */
  tenantName: z.string(),
  /** Parent project ID */
  projectId: z.uuid(),
  /** Project display name */
  projectName: z.string(),
  /** Parent board ID */
  boardId: z.uuid(),
  /** Column the task is currently in */
  columnId: z.uuid(),
  /** Column display title */
  columnTitle: z.string(),
  /** Task title */
  title: z.string(),
  /** Optional detailed description */
  description: z.string().nullable(),
  /** Task priority level */
  priority: z.enum(TaskPriority),
  /** Optional sprint assignment (null if in backlog) */
  sprintId: z.uuid().nullable(),
  /** Creation timestamp (ISO 8601) */
  createdAt: z.iso.datetime(),
  /** Last update timestamp (ISO 8601) */
  updatedAt: z.iso.datetime(),
});

/** Inferred MyTask type */
export type MyTask = z.infer<typeof MyTaskSchema>;
