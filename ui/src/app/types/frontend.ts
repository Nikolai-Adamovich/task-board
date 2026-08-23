/**
 * Frontend-only types that extend shared types.
 * These types are NOT part of the shared package — they represent
 * API response shapes or UI-specific compositions.
 */
import type { Tenant, TenantRole } from '@task-board/shared';
import type { TaskPriority } from '@task-board/shared';

/** Tenant enriched with the current user's role (returned by GET /api/tenants) */
export type TenantWithRole = Tenant & { role: TenantRole };

/** Cross-tenant invitation visible to the current user */
export interface MyInvitation {
  id: string;
  tenantId: string;
  tenantName: string;
  role: TenantRole;
  invitedEmail: string;
  invitedAt: string;
}

/** Pending invitation within a specific tenant (owner/admin view) */
export interface PendingInvitation {
  id: string;
  email: string;
  role: TenantRole;
  invitedBy: string;
  invitedAt: string;
  expiresAt: string;
}

/** Task summary for "My Tasks" cross-tenant dashboard */
export interface MyTask {
  id: string;
  tenantId: string;
  tenantName: string;
  projectId: string;
  projectName: string;
  boardId: string;
  columnId: string;
  columnTitle: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  sprintId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Request body for moving a task to a different column/status */
export interface MoveTask {
  taskId: string;
  statusId: string;
  position?: number;
  version: number;
}
