import type { SprintStatus } from '../constants/roles.js';

/** Sprint entity type */
export interface Sprint {
  /** Unique sprint identifier (UUID v4) */
  id: string;
  /** Owning tenant ID */
  tenantId: string;
  /** Parent project ID */
  projectId: string;
  /** Sprint name (e.g., "Sprint 1") */
  name: string;
  /** Sprint start date (ISO 8601 date) */
  startDate: string;
  /** Sprint end date (ISO 8601 date) */
  endDate: string;
  /** Optional sprint goal description */
  goal?: string | null;
  /** Sprint lifecycle status */
  status: SprintStatus;
  /** IDs of tasks assigned to this sprint */
  taskIds: string[];
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
}

/** Create sprint request body type */
export interface CreateSprint {
  name: string;
  startDate: string;
  endDate: string;
  goal?: string;
}

/** Update sprint request body type */
export interface UpdateSprint {
  name?: string;
  startDate?: string;
  endDate?: string;
  goal?: string;
  status?: SprintStatus;
}
