import { z } from 'zod';
import { nonEmptyString } from '../validators/common.js';

export const CreateCommentSchema = z.object({
  body: nonEmptyString(5000, 'Comment body'),
});

export const UpdateCommentSchema = z.object({
  body: nonEmptyString(5000, 'Comment body'),
});
