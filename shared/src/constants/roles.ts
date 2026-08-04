import { valuesOf } from '../utils/values-of.js';

/**
 * Type-safe enum-like constants.
 * Each constant provides the value object, the union type, and a values tuple.
 */

// ─── TenantRole ──────────────────────────────────────────────────────────────
export const TenantRole = {
  Owner: 'owner',
  Admin: 'admin',
  Member: 'member',
} as const;

export type TenantRole = (typeof TenantRole)[keyof typeof TenantRole];
export const TenantRoleValues = valuesOf(TenantRole);

// ─── ProjectRole ─────────────────────────────────────────────────────────────
export const ProjectRole = {
  Admin: 'admin',
  Developer: 'developer',
  Viewer: 'viewer',
} as const;

export type ProjectRole = (typeof ProjectRole)[keyof typeof ProjectRole];
export const ProjectRoleValues = valuesOf(ProjectRole);

// ─── TaskPriority ────────────────────────────────────────────────────────────
export const TaskPriority = {
  Low: 'low',
  Medium: 'medium',
  High: 'high',
  Critical: 'critical',
} as const;

export type TaskPriority = (typeof TaskPriority)[keyof typeof TaskPriority];
export const TaskPriorityValues = valuesOf(TaskPriority);

// ─── SprintStatus ────────────────────────────────────────────────────────────
export const SprintStatus = {
  Planned: 'planned',
  Active: 'active',
  Completed: 'completed',
} as const;

export type SprintStatus = (typeof SprintStatus)[keyof typeof SprintStatus];
export const SprintStatusValues = valuesOf(SprintStatus);

// ─── MemberStatus ────────────────────────────────────────────────────────────
export const MemberStatus = {
  Active: 'active',
  Pending: 'pending',
  Declined: 'declined',
  AccessRevoked: 'access_revoked',
} as const;

export type MemberStatus = (typeof MemberStatus)[keyof typeof MemberStatus];
export const MemberStatusValues = valuesOf(MemberStatus);

// ─── SubscriptionTier ────────────────────────────────────────────────────────
export const SubscriptionTier = {
  Free: 'free',
  Premium: 'premium',
} as const;

export type SubscriptionTier = (typeof SubscriptionTier)[keyof typeof SubscriptionTier];
export const SubscriptionTierValues = valuesOf(SubscriptionTier);
