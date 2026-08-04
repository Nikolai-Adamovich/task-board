import { z } from 'zod';
import { HttpMethod, ProjectRoleValues } from '@task-board/shared';
import { ProjectSchema, CreateProjectSchema, UpdateProjectSchema, ProjectMemberSchema } from '../schemas/project.js';
import { ErrorResponseSchema } from '../schemas/common.js';

/**
 * Project-related API contracts.
 */
export const projectContracts = {
  /** Create a new project within a tenant */
  create: {
    method: HttpMethod.Post,
    path: '/projects',
    body: CreateProjectSchema,
    response: ProjectSchema,
    error: ErrorResponseSchema,
  },

  /** List projects in a tenant */
  list: {
    method: HttpMethod.Get,
    path: '/projects',
    query: z.object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      search: z.string().optional(),
      tenantId: z.uuid(),
    }),
    response: z.object({
      data: z.array(ProjectSchema),
      total: z.number().int().nonnegative(),
      page: z.number().int().positive(),
      limit: z.number().int().positive(),
    }),
    error: ErrorResponseSchema,
  },

  /** Get a project by ID */
  getById: {
    method: HttpMethod.Get,
    path: '/projects/:id',
    response: ProjectSchema,
    error: ErrorResponseSchema,
  },

  /** Update a project */
  update: {
    method: HttpMethod.Patch,
    path: '/projects/:id',
    body: UpdateProjectSchema,
    response: ProjectSchema,
    error: ErrorResponseSchema,
  },

  /** Delete a project */
  remove: {
    method: HttpMethod.Delete,
    path: '/projects/:id',
    response: z.object({ success: z.literal(true) }),
    error: ErrorResponseSchema,
  },

  /** Add a member to a project */
  addMember: {
    method: HttpMethod.Post,
    path: '/projects/:id/members',
    body: z.object({
      userId: z.uuid(),
      role: z.enum(ProjectRoleValues),
    }),
    response: ProjectMemberSchema,
    error: ErrorResponseSchema,
  },

  /** List members of a project */
  listMembers: {
    method: HttpMethod.Get,
    path: '/projects/:id/members',
    response: z.object({
      data: z.array(ProjectMemberSchema),
      total: z.number().int().nonnegative(),
    }),
    error: ErrorResponseSchema,
  },

  /** Update a member's role in a project */
  updateMember: {
    method: HttpMethod.Patch,
    path: '/projects/:id/members/:userId',
    body: z.object({
      role: z.enum(ProjectRoleValues),
    }),
    response: ProjectMemberSchema,
    error: ErrorResponseSchema,
  },

  /** Remove a member from a project */
  removeMember: {
    method: HttpMethod.Delete,
    path: '/projects/:id/members/:userId',
    response: z.object({ success: z.literal(true) }),
    error: ErrorResponseSchema,
  },
} as const;
