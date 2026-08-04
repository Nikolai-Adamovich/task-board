import type { TaskPriority } from '../constants/roles.js';

/** Task entity type */
export interface Task {
  /** Unique task identifier (UUID v4) */
  id: string;
  /** Owning tenant ID */
  tenantId: string;
  /** Parent project ID */
  projectId: string;
  /** Parent board ID */
  boardId: string;
  /** Column the task is currently in */
  columnId: string;
  /** Optional sprint assignment (null if in backlog) */
  sprintId: string | null;
  /** Task title */
  title: string;
  /** Optional detailed description (markdown) */
  description?: string | null;
  /** User IDs assigned to this task */
  assigneeIds: string[];
  /** Task priority level */
  priority: TaskPriority;
  /** Position/order within the column (for drag-and-drop) */
  position: number;
  /** User ID of the task creator */
  createdBy: string;
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
}

/** Create task request body type */
export interface CreateTask {
  title: string;
  description?: string;
  projectId: string;
  boardId: string;
  columnId: string;
  sprintId?: string;
  priority: TaskPriority;
  assigneeIds: string[];
}

/** Update task request body type */
export interface UpdateTask {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  assigneeIds?: string[];
}

/** Move task request body type */
export interface MoveTask {
  taskId: string;
  targetColumnId: string;
  targetSprintId?: string;
}

/** Assign task request body type */
export interface AssignTask {
  taskId: string;
  assigneeIds: string[];
}

/** Denormalized task for cross-tenant "my tasks" view */
export interface MyTask {
  /** Unique task identifier (UUID v4) */
  id: string;
  /** Owning tenant ID */
  tenantId: string;
  /** Tenant display name */
  tenantName: string;
  /** Parent project ID */
  projectId: string;
  /** Project display name */
  projectName: string;
  /** Parent board ID */
  boardId: string;
  /** Column the task is currently in */
  columnId: string;
  /** Column display title */
  columnTitle: string;
  /** Task title */
  title: string;
  /** Optional detailed description */
  description: string | null;
  /** Task priority level */
  priority: TaskPriority;
  /** Optional sprint assignment (null if in backlog) */
  sprintId: string | null;
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
}
