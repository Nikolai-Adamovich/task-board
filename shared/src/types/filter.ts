import type { TaskPriorityLevel } from '../constants/priority.js';

/** Filter criteria — all fields are optional and combined with AND logic */
export interface FilterCriteria {
  /** Full-text search string */
  search?: string;
  /** Filter by status IDs */
  statusIds?: string[];
  /** Filter by priority levels (positions in TASK_PRIORITY_CONFIG) */
  priorityLevel?: TaskPriorityLevel[];
  /** Filter by task type IDs */
  typeIds?: string[];
  /** Filter by assignee user IDs */
  assigneeIds?: string[];
  /** Filter by reporter user IDs */
  reporterIds?: string[];
  /** Filter by sprint IDs */
  sprintIds?: string[];
  /** Filter by label IDs */
  labelIds?: string[];
  /** Only tasks created on/after this ISO date (`YYYY-MM-DD`, inclusive) */
  createdFrom?: string;
  /** Only tasks created on/before this ISO date (`YYYY-MM-DD`, inclusive) */
  createdTo?: string;
  /** Only tasks updated on/after this ISO date (`YYYY-MM-DD`, inclusive) */
  updatedFrom?: string;
  /** Only tasks updated on/before this ISO date (`YYYY-MM-DD`, inclusive) */
  updatedTo?: string;
}

/** Sort specification */
export interface FilterSort {
  /** Field to sort by */
  field: string;
  /** Sort direction */
  direction: 'asc' | 'desc';
}

/** Saved filter entity type */
export interface Filter {
  /** Unique filter identifier (UUID v4) */
  id: string;
  /** Parent project ID */
  projectId: string;
  /** User ID who owns this filter */
  userId: string;
  /** Display name for the saved filter */
  name: string;
  /** Filter criteria */
  filters: FilterCriteria;
  /** Sort specification */
  sort: FilterSort;
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
}

/** Create filter request body type */
export interface CreateFilter {
  name: string;
  filters: FilterCriteria;
  sort: FilterSort;
}

/** Update filter request body type */
export interface UpdateFilter {
  name?: string;
  filters?: FilterCriteria;
  sort?: FilterSort;
}
