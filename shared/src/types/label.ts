/** Label entity type (project-level label for categorizing tasks) */
export interface Label {
  /** Unique label identifier (UUID v4) */
  id: string;
  /** Parent project ID */
  projectId: string;
  /** Display name of the label */
  name: string;
  /** Normalized name for case-insensitive lookups */
  normalizedName: string;
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
}

/** Create label request body type */
export interface CreateLabel {
  name: string;
}

/** Update label request body type */
export interface UpdateLabel {
  name: string;
}
