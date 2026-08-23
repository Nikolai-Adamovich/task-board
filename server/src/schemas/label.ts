import { z } from 'zod';
import { nonEmptyString } from '../validators/common.js';

/**
 * Schema for creating a new label.
 */
export const CreateLabelSchema = z.object({
  name: nonEmptyString(100, 'Label name'),
});

/**
 * Schema for updating an existing label.
 */
export const UpdateLabelSchema = z.object({
  name: nonEmptyString(100, 'Label name'),
});
