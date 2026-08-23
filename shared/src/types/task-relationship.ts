import type { TaskRelationshipType } from '../constants/roles.js';

/** Task relationship entity type */
export interface TaskRelationship {
  /** Unique relationship identifier (UUID v4) */
  id: string;
  /** Parent project ID */
  projectId: string;
  /** Source task ID */
  sourceTaskId: string;
  /** Target task ID */
  targetTaskId: string;
  /** Relationship type */
  type: TaskRelationshipType;
  /** User ID of the person who created the relationship */
  createdById: string;
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
}

/** Create task relationship request body type */
export interface CreateTaskRelationship {
  targetTaskId: string;
  type: TaskRelationshipType;
}
