/** Per-user, per-project board selection preference */
export interface UserProjectBoardPreference {
  /** Unique preference identifier (UUID v4) */
  id: string;
  /** User ID */
  userId: string;
  /** Project ID */
  projectId: string;
  /** Default board ID for this project (null if not set) */
  defaultBoardId: string | null;
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
}

/** Update user project board preference request body type */
export interface UpdateUserProjectBoardPreference {
  defaultBoardId: string | null;
}
