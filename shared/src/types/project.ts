import type { ProjectRole, ProjectStatus, ArchiveReason } from '../constants/roles.js';

/** Project entity type */
export interface Project {
  /** Unique project identifier (UUID v4) */
  id: string;
  /** Owning tenant ID */
  tenantId: string;
  /** Short unique project key (e.g., "PROJ") */
  key: string;
  /** Project name */
  name: string;
  /** Optional project description */
  description: string | null;
  /** Project lifecycle status */
  status: ProjectStatus;
  /** Default status ID assigned to new tasks */
  defaultStatusId: string;
  /** Reason for archival (null if not archived) */
  archiveReason: ArchiveReason | null;
  /** Scheduled deletion timestamp (ISO 8601, null if not scheduled) */
  deletionScheduledAt: string | null;
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
}

/** Create project request body type */
export interface CreateProject {
  key: string;
  name: string;
  description?: string;
}

/** Update project request body type */
export interface UpdateProject {
  name?: string;
  description?: string;
}

/** Project membership type */
export interface ProjectMember {
  /** Unique member identifier (UUID v4) */
  id: string;
  /** Project ID */
  projectId: string;
  /** User ID of the member */
  userId: string;
  /** Role of the user within the project */
  role: ProjectRole;
  /** Display name of the user (resolved from users collection) */
  displayName?: string;
  /** Email of the user (resolved from users collection) */
  email?: string;
  /** Avatar URL of the user (resolved from users collection) */
  avatarUrl?: string | null;
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
}
