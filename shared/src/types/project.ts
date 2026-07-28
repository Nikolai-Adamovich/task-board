import type { z } from 'zod';
import type {
  ProjectSchema,
  CreateProjectSchema,
  UpdateProjectSchema,
  ProjectMemberSchema,
} from '../schemas/project.js';

/** Project entity type */
export type Project = z.infer<typeof ProjectSchema>;

/** Create project request body type */
export type CreateProject = z.infer<typeof CreateProjectSchema>;

/** Update project request body type */
export type UpdateProject = z.infer<typeof UpdateProjectSchema>;

/** Project member type */
export type ProjectMember = z.infer<typeof ProjectMemberSchema>;
