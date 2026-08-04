import type { ProjectRole } from '../constants/roles.js';

/** Project entity type */
export interface Project {
  /** Unique project identifier (UUID v4) */
  id: string;
  /** Owning tenant ID */
  tenantId: string;
  /** Project name */
  name: string;
  /** URL-friendly slug for the project */
  slug: string;
  /** Optional project description */
  description?: string | null;
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
}

/** Create project request body type */
export interface CreateProject {
  name: string;
  slug: string;
  description?: string;
}

/** Update project request body type */
export interface UpdateProject {
  name?: string;
  slug?: string;
  description?: string;
}

/** Project membership type */
export interface ProjectMember {
  /** User ID of the member */
  userId: string;
  /** Project ID */
  projectId: string;
  /** Tenant ID (denormalized for multi-tenant queries) */
  tenantId: string;
  /** Role of the user within the project */
  role: ProjectRole;
}
