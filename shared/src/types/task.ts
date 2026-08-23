import type { TaskPriority } from '../constants/roles.js';
import type { IdentitySnapshot } from './tenant.js';

/** Task entity type */
export interface Task {
  /** Unique task identifier (UUID v4) */
  id: string;
  /** Parent project ID */
  projectId: string;
  /** Sequential task number within the project */
  number: number;
  /** Task type ID (references TaskType) */
  typeId: string;
  /** Task title */
  title: string;
  /** Optional detailed description (markdown) */
  description: string | null;
  /** Status ID (references Status) */
  statusId: string;
  /** Task priority level */
  priority: TaskPriority;
  /** User ID of the reporter */
  reporterId: string | null;
  /** Denormalized reporter identity at time of assignment */
  reporterSnapshot: IdentitySnapshot | null;
  /** User ID of the assignee */
  assigneeId: string | null;
  /** Denormalized assignee identity at time of assignment */
  assigneeSnapshot: IdentitySnapshot | null;
  /** Optional sprint assignment (null if in backlog) */
  sprintId: string | null;
  /** Label IDs attached to this task */
  labelIds: string[];
  /** User ID of the task creator */
  createdById: string;
  /** Denormalized creator identity at time of creation */
  createdBySnapshot: IdentitySnapshot;
  /** Optimistic concurrency version */
  version: number;
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
}

/** Create task request body type */
export interface CreateTask {
  typeId: string;
  title: string;
  description?: string;
  statusId: string;
  priority: TaskPriority;
  assigneeId?: string;
  sprintId?: string;
  labelIds?: string[];
}

/** Update task request body type (version is required for optimistic concurrency) */
export interface UpdateTask {
  title?: string;
  description?: string;
  statusId?: string;
  priority?: TaskPriority;
  assigneeId?: string | null;
  typeId?: string;
  sprintId?: string | null;
  labelIds?: string[];
  version: number;
}
