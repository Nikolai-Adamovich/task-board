import { z } from 'zod';
import { uuid } from '../validators/common.js';

/**
 * Schema for updating user project board preferences.
 */
export const UpdateUserProjectBoardPreferenceSchema = z.object({
  defaultBoardId: uuid().nullable(),
});
