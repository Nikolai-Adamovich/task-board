import { z } from 'zod';
import { ProjectRoleValues } from '@task-board/shared';
import {
  uuid,
  slug,
  nonEmptyString,
  optionalString,
  nullableOptionalString,
  isoDateTime,
} from '../validators/common.js';

/**
 * Project entity schema.
 * A project belongs to a tenant and contains boards and tasks.
 */
export const ProjectSchema = z.object({
  /** Unique project identifier (UUID v4) */
  id: uuid(),
  /** Owning tenant ID */
  tenantId: uuid(),
  /** Project name */
  name: nonEmptyString(100, 'Project name'),
  /** URL-friendly slug for the project */
  slug: slug(),
  /** Optional project description */
  description: nullableOptionalString(500),
  /** Creation timestamp (ISO 8601) */
  createdAt: isoDateTime(),
  /** Last update timestamp (ISO 8601) */
  updatedAt: isoDateTime(),
});

/**
 * Schema for creating a new project.
 */
export const CreateProjectSchema = z.object({
  name: nonEmptyString(100, 'Project name'),
  slug: slug(),
  description: optionalString(500),
});

/**
 * Schema for updating an existing project.
 * All fields are optional (partial update).
 */
export const UpdateProjectSchema = z.object({
  name: nonEmptyString(100, 'Project name').optional(),
  slug: slug().optional(),
  description: optionalString(500),
});

/**
 * Project membership schema.
 * Represents a user's membership in a project with a specific role.
 */
export const ProjectMemberSchema = z.object({
  /** User ID of the member */
  userId: uuid(),
  /** Project ID */
  projectId: uuid(),
  /** Tenant ID (denormalized for multi-tenant queries) */
  tenantId: uuid(),
  /** Role of the user within the project */
  role: z.enum(ProjectRoleValues),
});
