import * as z from 'zod';
import { AuditEntityTypeValues } from '@task-board/shared';
import { uuid } from '../validators/common.js';

export const AuditQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  entityType: z.enum(AuditEntityTypeValues).optional(),
  entityId: uuid().optional(),
  /** R3-P7: filter by action (CREATED | UPDATED | DELETED) */
  action: z.enum(['CREATED', 'UPDATED', 'DELETED']).optional(),
  /** R3-P7: filter by actor user id */
  actorId: uuid().optional(),
  /** R3-P7: time sort direction — defaults to desc (newest first) */
  sort: z.enum(['asc', 'desc']).optional().default('desc'),
});

// ─── Response schemas (R3-P7, additive) ───────────────────────────────────────
// The audit list response enriches each event with human-readable labels so the
// UI never renders raw UUIDs. Raw change values are preserved alongside labels.

export const AuditChangeResponseSchema = z.object({
  field: z.string(),
  oldValue: z.unknown().nullable(),
  newValue: z.unknown().nullable(),
  oldLabel: z.string().nullable().optional(),
  newLabel: z.string().nullable().optional(),
  rawOldValue: z.unknown().optional(),
  rawNewValue: z.unknown().optional(),
});

export const AuditEventResponseSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  projectId: z.string().nullable(),
  entityType: z.string(),
  entityId: z.string(),
  action: z.string(),
  actor: z.object({ userId: z.string().nullable(), displayName: z.string() }),
  changes: z.array(AuditChangeResponseSchema),
  createdAt: z.string(),
  entityLabel: z.string().nullable().optional(),
});
