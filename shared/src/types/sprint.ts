import type { z } from 'zod';
import type { SprintSchema, CreateSprintSchema, UpdateSprintSchema } from '../schemas/sprint.js';

/** Sprint entity type */
export type Sprint = z.infer<typeof SprintSchema>;

/** Create sprint request body type */
export type CreateSprint = z.infer<typeof CreateSprintSchema>;

/** Update sprint request body type */
export type UpdateSprint = z.infer<typeof UpdateSprintSchema>;
