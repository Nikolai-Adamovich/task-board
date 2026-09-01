import * as z from 'zod';
import { TaskRelationshipTypeValues } from '@task-board/shared';
import { uuid } from '../validators/common.js';

export const CreateTaskRelationshipSchema = z.object({
  targetTaskId: uuid(),
  type: z.enum(TaskRelationshipTypeValues),
});
