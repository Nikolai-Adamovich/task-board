import { z } from 'zod';
import { AuditEntityTypeValues } from '@task-board/shared';
import { uuid } from '../validators/common.js';

export const AuditQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  entityType: z.enum(AuditEntityTypeValues).optional(),
  entityId: uuid().optional(),
});
