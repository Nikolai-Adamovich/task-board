import { z } from 'zod';
import { HttpMethod } from '../constants/http.js';
import { TaskPrioritySchema } from '../constants/roles.js';
import { TaskSchema, CreateTaskSchema, UpdateTaskSchema, MoveTaskSchema, AssignTaskSchema } from '../schemas/task.js';
import { ErrorResponseSchema } from '../schemas/common.js';

/**
 * Task-related API contracts.
 */
export const taskContracts = {
  /** Create a new task */
  create: {
    method: HttpMethod.Post,
    path: '/tasks',
    body: CreateTaskSchema,
    response: TaskSchema,
    error: ErrorResponseSchema,
  },

  /** List tasks (with optional filters) */
  list: {
    method: HttpMethod.Get,
    path: '/tasks',
    query: z.object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      projectId: z.uuid().optional(),
      boardId: z.uuid().optional(),
      columnId: z.uuid().optional(),
      sprintId: z.uuid().optional(),
      assigneeId: z.uuid().optional(),
      priority: TaskPrioritySchema.optional(),
      search: z.string().optional(),
    }),
    response: z.object({
      data: z.array(TaskSchema),
      total: z.number().int().nonnegative(),
      page: z.number().int().positive(),
      limit: z.number().int().positive(),
    }),
    error: ErrorResponseSchema,
  },

  /** Get a task by ID */
  getById: {
    method: HttpMethod.Get,
    path: '/tasks/:id',
    response: TaskSchema,
    error: ErrorResponseSchema,
  },

  /** Update a task */
  update: {
    method: HttpMethod.Patch,
    path: '/tasks/:id',
    body: UpdateTaskSchema,
    response: TaskSchema,
    error: ErrorResponseSchema,
  },

  /** Delete a task */
  remove: {
    method: HttpMethod.Delete,
    path: '/tasks/:id',
    response: z.object({ success: z.literal(true) }),
    error: ErrorResponseSchema,
  },

  /** Move a task to a different column (drag-and-drop) */
  move: {
    method: HttpMethod.Post,
    path: '/tasks/:id/move',
    body: MoveTaskSchema,
    response: TaskSchema,
    error: ErrorResponseSchema,
  },

  /** Assign/unassign users to a task */
  assign: {
    method: HttpMethod.Post,
    path: '/tasks/:id/assign',
    body: AssignTaskSchema,
    response: TaskSchema,
    error: ErrorResponseSchema,
  },
} as const;
