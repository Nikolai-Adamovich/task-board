import { z } from 'zod';
import { SprintStatusValues } from '@task-board/shared';
import { nonEmptyString } from '../validators/common.js';

/**
 * V7-7: sprints are date-granular, but the UI sends full ISO datetimes
 * (`new Date(...).toISOString()`). Accept both `YYYY-MM-DD` and full
 * RFC 3339 datetimes and normalize to date-only (`YYYY-MM-DD`) for storage.
 */
const sprintDate = z.union([z.iso.date(), z.iso.datetime()]).transform((value) => value.slice(0, 10));

/**
 * Schema for creating a new sprint.
 */
export const CreateSprintSchema = z
  .object({
    name: nonEmptyString(200, 'Sprint name'),
    startDate: sprintDate.optional(),
    endDate: sprintDate.optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.endDate >= data.startDate;
      }
      return true;
    },
    { message: 'endDate must be >= startDate' },
  );

/**
 * Schema for updating an existing sprint.
 */
export const UpdateSprintSchema = z
  .object({
    name: nonEmptyString(200, 'Sprint name').optional(),
    startDate: sprintDate.nullable().optional(),
    endDate: sprintDate.nullable().optional(),
    status: z.enum(SprintStatusValues).optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.endDate >= data.startDate;
      }
      return true;
    },
    { message: 'endDate must be >= startDate' },
  );
