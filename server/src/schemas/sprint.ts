import { z } from 'zod';
import { SprintStatusValues } from '@task-board/shared';
import { nonEmptyString } from '../validators/common.js';

/**
 * Schema for creating a new sprint.
 */
export const CreateSprintSchema = z
  .object({
    name: nonEmptyString(200, 'Sprint name'),
    startDate: z.iso.date().optional(),
    endDate: z.iso.date().optional(),
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
    startDate: z.iso.date().nullable().optional(),
    endDate: z.iso.date().nullable().optional(),
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
