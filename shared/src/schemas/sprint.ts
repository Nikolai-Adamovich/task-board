import { z } from 'zod';
import { SprintStatus } from '../constants/roles.js';

/**
 * Sprint entity schema.
 * Sprints are time-boxed iterations within a project that group tasks.
 */
export const SprintSchema = z.object({
  /** Unique sprint identifier (UUID v4) */
  id: z.string().uuid(),
  /** Owning tenant ID */
  tenantId: z.string().uuid(),
  /** Parent project ID */
  projectId: z.string().uuid(),
  /** Sprint name (e.g., "Sprint 1") */
  name: z.string().min(1).max(100),
  /** Sprint start date (ISO 8601 date) */
  startDate: z.string().datetime(),
  /** Sprint end date (ISO 8601 date) */
  endDate: z.string().datetime(),
  /** Optional sprint goal description */
  goal: z.string().max(500).nullable().optional(),
  /** Sprint lifecycle status */
  status: z.enum(SprintStatus),
  /** IDs of tasks assigned to this sprint */
  taskIds: z.array(z.string().uuid()),
  /** Creation timestamp (ISO 8601) */
  createdAt: z.string().datetime(),
  /** Last update timestamp (ISO 8601) */
  updatedAt: z.string().datetime(),
});

/** Inferred Sprint type */
export type Sprint = z.infer<typeof SprintSchema>;

/**
 * Schema for creating a new sprint.
 */
export const CreateSprintSchema = z.object({
  name: z.string().min(1, 'Sprint name is required').max(100, 'Sprint name must be at most 100 characters'),
  startDate: z.string().datetime('Invalid start date'),
  endDate: z.string().datetime('Invalid end date'),
  goal: z.string().max(500).optional(),
});

/** Inferred CreateSprint type */
export type CreateSprint = z.infer<typeof CreateSprintSchema>;

/**
 * Schema for updating an existing sprint.
 * All fields are optional (partial update).
 */
export const UpdateSprintSchema = z.object({
  name: z
    .string()
    .min(1, 'Sprint name cannot be empty')
    .max(100, 'Sprint name must be at most 100 characters')
    .optional(),
  startDate: z.string().datetime('Invalid start date').optional(),
  endDate: z.string().datetime('Invalid end date').optional(),
  goal: z.string().max(500).optional(),
  status: z.enum(SprintStatus).optional(),
});

/** Inferred UpdateSprint type */
export type UpdateSprint = z.infer<typeof UpdateSprintSchema>;
