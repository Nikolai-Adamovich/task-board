import { z } from 'zod';
import { TaskPriority } from '../constants/roles.js';

/**
 * Task entity schema.
 * The core work item in the task board. Tasks belong to a column within a board.
 */
export const TaskSchema = z.object({
  /** Unique task identifier (UUID v4) */
  id: z.string().uuid(),
  /** Owning tenant ID */
  tenantId: z.string().uuid(),
  /** Parent project ID */
  projectId: z.string().uuid(),
  /** Parent board ID */
  boardId: z.string().uuid(),
  /** Column the task is currently in */
  columnId: z.string().uuid(),
  /** Optional sprint assignment (null if in backlog) */
  sprintId: z.string().uuid().nullable(),
  /** Task title */
  title: z.string().min(1).max(200),
  /** Optional detailed description (markdown) */
  description: z.string().max(5000).nullable().optional(),
  /** User IDs assigned to this task */
  assigneeIds: z.array(z.string().uuid()),
  /** Task priority level */
  priority: z.enum(TaskPriority),
  /** Position/order within the column (for drag-and-drop) */
  position: z.number().nonnegative(),
  /** User ID of the task creator */
  createdBy: z.string().uuid(),
  /** Creation timestamp (ISO 8601) */
  createdAt: z.string().datetime(),
  /** Last update timestamp (ISO 8601) */
  updatedAt: z.string().datetime(),
});

/** Inferred Task type */
export type Task = z.infer<typeof TaskSchema>;

/**
 * Schema for creating a new task.
 */
export const CreateTaskSchema = z.object({
  title: z.string().min(1, 'Task title is required').max(200, 'Task title must be at most 200 characters'),
  description: z.string().max(5000).optional(),
  projectId: z.string().uuid('Invalid project ID'),
  boardId: z.string().uuid('Invalid board ID'),
  columnId: z.string().uuid('Invalid column ID'),
  sprintId: z.string().uuid('Invalid sprint ID').optional(),
  priority: z.enum(TaskPriority).default('medium'),
  assigneeIds: z.array(z.string().uuid()).default([]),
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
  assigneeIds: z.array(z.string().uuid()).optional(),
});

/** Inferred UpdateTask type */
export type UpdateTask = z.infer<typeof UpdateTaskSchema>;

/**
 * Schema for moving a task to a different column (and optionally a sprint).
 * Used for drag-and-drop operations on the board.
 */
export const MoveTaskSchema = z.object({
  taskId: z.string().uuid('Invalid task ID'),
  targetColumnId: z.string().uuid('Invalid target column ID'),
  targetSprintId: z.string().uuid('Invalid target sprint ID').optional(),
});

/** Inferred MoveTask type */
export type MoveTask = z.infer<typeof MoveTaskSchema>;

/**
 * Schema for assigning/unassigning users to a task.
 */
export const AssignTaskSchema = z.object({
  taskId: z.string().uuid('Invalid task ID'),
  assigneeIds: z.array(z.string().uuid()),
});

/** Inferred AssignTask type */
export type AssignTask = z.infer<typeof AssignTaskSchema>;
