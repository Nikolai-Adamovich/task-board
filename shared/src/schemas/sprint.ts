import { z } from 'zod';
import { SprintStatus } from '../constants/roles.js';
import { uuid, nonEmptyString, optionalString, nullableOptionalString, isoDateTime } from '../validators/common.js';

/**
 * Sprint entity schema.
 * Sprints are time-boxed iterations within a project that group tasks.
 */
export const SprintSchema = z.object({
  /** Unique sprint identifier (UUID v4) */
  id: uuid(),
  /** Owning tenant ID */
  tenantId: uuid(),
  /** Parent project ID */
  projectId: uuid(),
  /** Sprint name (e.g., "Sprint 1") */
  name: nonEmptyString(100, 'Sprint name'),
  /** Sprint start date (ISO 8601 date) */
  startDate: isoDateTime(),
  /** Sprint end date (ISO 8601 date) */
  endDate: isoDateTime(),
  /** Optional sprint goal description */
  goal: nullableOptionalString(500),
  /** Sprint lifecycle status */
  status: z.enum(SprintStatus),
  /** IDs of tasks assigned to this sprint */
  taskIds: z.array(uuid()),
  /** Creation timestamp (ISO 8601) */
  createdAt: isoDateTime(),
  /** Last update timestamp (ISO 8601) */
  updatedAt: isoDateTime(),
});

/** Inferred Sprint type */
export type Sprint = z.infer<typeof SprintSchema>;

/**
 * Schema for creating a new sprint.
 */
export const CreateSprintSchema = z.object({
  name: nonEmptyString(100, 'Sprint name'),
  startDate: isoDateTime(),
  endDate: isoDateTime(),
  goal: optionalString(500),
});

/** Inferred CreateSprint type */
export type CreateSprint = z.infer<typeof CreateSprintSchema>;

/**
 * Schema for updating an existing sprint.
 * All fields are optional (partial update).
 */
export const UpdateSprintSchema = z.object({
  name: nonEmptyString(100, 'Sprint name').optional(),
  startDate: isoDateTime().optional(),
  endDate: isoDateTime().optional(),
  goal: optionalString(500),
  status: z.enum(SprintStatus).optional(),
});

/** Inferred UpdateSprint type */
export type UpdateSprint = z.infer<typeof UpdateSprintSchema>;
