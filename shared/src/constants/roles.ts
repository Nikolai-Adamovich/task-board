import { z } from 'zod';

/**
 * Type-safe enum-like constants with Zod schema support.
 * Each constant provides both the value object and a Zod enum schema.
 */

// ─── TenantRole ──────────────────────────────────────────────────────────────
export const TenantRole = {
  Owner: 'owner',
  Admin: 'admin',
  Member: 'member',
} as const;

export type TenantRole = (typeof TenantRole)[keyof typeof TenantRole];
export const TenantRoleSchema = z.enum(TenantRole);
export const TenantRoleValues = Object.values(TenantRole) as [TenantRole, ...TenantRole[]];

// ─── ProjectRole ─────────────────────────────────────────────────────────────
export const ProjectRole = {
  Admin: 'admin',
  Developer: 'developer',
  Viewer: 'viewer',
} as const;

export type ProjectRole = (typeof ProjectRole)[keyof typeof ProjectRole];
export const ProjectRoleSchema = z.enum(ProjectRole);
export const ProjectRoleValues = Object.values(ProjectRole) as [ProjectRole, ...ProjectRole[]];

// ─── TaskPriority ────────────────────────────────────────────────────────────
export const TaskPriority = {
  Low: 'low',
  Medium: 'medium',
  High: 'high',
  Critical: 'critical',
} as const;

export type TaskPriority = (typeof TaskPriority)[keyof typeof TaskPriority];
export const TaskPrioritySchema = z.enum(TaskPriority);
export const TaskPriorityValues = Object.values(TaskPriority) as [TaskPriority, ...TaskPriority[]];

// ─── SprintStatus ────────────────────────────────────────────────────────────
export const SprintStatus = {
  Planned: 'planned',
  Active: 'active',
  Completed: 'completed',
} as const;

export type SprintStatus = (typeof SprintStatus)[keyof typeof SprintStatus];
export const SprintStatusSchema = z.enum(SprintStatus);
export const SprintStatusValues = Object.values(SprintStatus) as [SprintStatus, ...SprintStatus[]];

// ─── MemberStatus ────────────────────────────────────────────────────────────
export const MemberStatus = {
  Active: 'active',
  Pending: 'pending',
  Declined: 'declined',
  AccessRevoked: 'access_revoked',
} as const;

export type MemberStatus = (typeof MemberStatus)[keyof typeof MemberStatus];
export const MemberStatusSchema = z.enum(MemberStatus);
export const MemberStatusValues = Object.values(MemberStatus) as [MemberStatus, ...MemberStatus[]];

// ─── SubscriptionTier ────────────────────────────────────────────────────────
export const SubscriptionTier = {
  Free: 'free',
  Premium: 'premium',
} as const;

export type SubscriptionTier = (typeof SubscriptionTier)[keyof typeof SubscriptionTier];
export const SubscriptionTierSchema = z.enum(SubscriptionTier);
export const SubscriptionTierValues = Object.values(SubscriptionTier) as [SubscriptionTier, ...SubscriptionTier[]];
