import type { z } from 'zod';
import type {
  TaskSchema,
  CreateTaskSchema,
  UpdateTaskSchema,
  MoveTaskSchema,
  AssignTaskSchema,
  MyTaskSchema,
} from '../schemas/task.js';

/** Task entity type */
export type Task = z.infer<typeof TaskSchema>;

/** Create task request body type */
export type CreateTask = z.infer<typeof CreateTaskSchema>;

/** Update task request body type */
export type UpdateTask = z.infer<typeof UpdateTaskSchema>;

/** Move task request body type */
export type MoveTask = z.infer<typeof MoveTaskSchema>;

/** Assign task request body type */
export type AssignTask = z.infer<typeof AssignTaskSchema>;

/** Denormalized task for cross-tenant "my tasks" view */
export type MyTask = z.infer<typeof MyTaskSchema>;
