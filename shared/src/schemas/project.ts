import { z } from 'zod';
import { ProjectRole } from '../constants/roles.js';

/**
 * Project entity schema.
 * A project belongs to a tenant and contains boards and tasks.
 */
export const ProjectSchema = z.object({
  /** Unique project identifier (UUID v4) */
  id: z.string().uuid(),
  /** Owning tenant ID */
  tenantId: z.string().uuid(),
  /** Project name */
  name: z.string().min(1).max(100),
  /** URL-friendly slug for the project */
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/),
  /** Optional project description */
  description: z.string().max(500).nullable().optional(),
  /** Creation timestamp (ISO 8601) */
  createdAt: z.string().datetime(),
  /** Last update timestamp (ISO 8601) */
  updatedAt: z.string().datetime(),
});

/** Inferred Project type */
export type Project = z.infer<typeof ProjectSchema>;

/**
 * Schema for creating a new project.
 */
export const CreateProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100, 'Project name must be at most 100 characters'),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(80, 'Slug must be at most 80 characters')
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  description: z.string().max(500).optional(),
});

/** Inferred CreateProject type */
export type CreateProject = z.infer<typeof CreateProjectSchema>;

/**
 * Schema for updating an existing project.
 * All fields are optional (partial update).
 */
export const UpdateProjectSchema = z.object({
  name: z
    .string()
    .min(1, 'Project name cannot be empty')
    .max(100, 'Project name must be at most 100 characters')
    .optional(),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(80, 'Slug must be at most 80 characters')
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
    .optional(),
  description: z.string().max(500).optional(),
});

/** Inferred UpdateProject type */
export type UpdateProject = z.infer<typeof UpdateProjectSchema>;

/**
 * Project membership schema.
 * Represents a user's membership in a project with a specific role.
 */
export const ProjectMemberSchema = z.object({
  /** User ID of the member */
  userId: z.string().uuid(),
  /** Project ID */
  projectId: z.string().uuid(),
  /** Tenant ID (denormalized for multi-tenant queries) */
  tenantId: z.string().uuid(),
  /** Role of the user within the project */
  role: z.enum(ProjectRole),
});

/** Inferred ProjectMember type */
export type ProjectMember = z.infer<typeof ProjectMemberSchema>;
