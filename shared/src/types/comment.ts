import type { IdentitySnapshot } from './tenant.js';

/** Comment entity type */
export interface Comment {
  /** Unique comment identifier (UUID v4) */
  id: string;
  /** Parent task ID */
  taskId: string;
  /** User ID of the comment author (null if user was deleted) */
  authorId: string | null;
  /** Denormalized author identity at time of comment creation */
  authorSnapshot: IdentitySnapshot;
  /** Comment body (markdown) */
  body: string;
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
}

/** Create comment request body type */
export interface CreateComment {
  body: string;
}

/** Update comment request body type */
export interface UpdateComment {
  body: string;
}
