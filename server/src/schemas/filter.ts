import { z } from 'zod';
import { TaskPriorityValues } from '@task-board/shared';
import { nonEmptyString, uuid } from '../validators/common.js';

/**
 * Filter criteria schema — all fields are optional and combined with AND logic.
 */
const FilterCriteriaSchema = z.object({
  search: z.string().optional(),
  statusIds: z.array(uuid()).optional(),
  priority: z.array(z.enum(TaskPriorityValues)).optional(),
  typeIds: z.array(uuid()).optional(),
  assigneeIds: z.array(uuid()).optional(),
  reporterIds: z.array(uuid()).optional(),
  sprintIds: z.array(uuid()).optional(),
  labelIds: z.array(uuid()).optional(),
});
/**
 * Sort specification schema.
 */
const FilterSortSchema = z.object({
  field: z.string(),
  direction: z.enum(['asc', 'desc']),
});

export const CreateFilterSchema = z.object({
  name: nonEmptyString(100, 'Filter name'),
  filters: FilterCriteriaSchema,
  sort: FilterSortSchema,
});

export const UpdateFilterSchema = z.object({
  name: nonEmptyString(100, 'Filter name').optional(),
  filters: FilterCriteriaSchema.optional(),
  sort: FilterSortSchema.optional(),
});
