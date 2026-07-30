/** Tenant-level roles within an organization */
export const TenantRole = {
  Owner: 'owner',
  Admin: 'admin',
  Member: 'member',
} as const;

/** Union type of tenant role values */
export type TenantRole = (typeof TenantRole)[keyof typeof TenantRole];

/** Project-level roles for project members */
export const ProjectRole = {
  Admin: 'admin',
  Developer: 'developer',
  Viewer: 'viewer',
} as const;

/** Union type of project role values */
export type ProjectRole = (typeof ProjectRole)[keyof typeof ProjectRole];

/** Task priority levels */
export const TaskPriority = {
  Low: 'low',
  Medium: 'medium',
  High: 'high',
  Critical: 'critical',
} as const;

/** Union type of task priority values */
export type TaskPriority = (typeof TaskPriority)[keyof typeof TaskPriority];

/** Sprint lifecycle statuses */
export const SprintStatus = {
  Planned: 'planned',
  Active: 'active',
  Completed: 'completed',
} as const;

/** Union type of sprint status values */
export type SprintStatus = (typeof SprintStatus)[keyof typeof SprintStatus];

/** Member invitation/activation status */
export const MemberStatus = {
  Active: 'active',
  Pending: 'pending',
  Declined: 'declined',
  AccessRevoked: 'access_revoked',
} as const;

/** Union type of member status values */
export type MemberStatus = (typeof MemberStatus)[keyof typeof MemberStatus];

/** Subscription tier levels */
export const SubscriptionTier = {
  Free: 'free',
  Premium: 'premium',
} as const;

/** Union type of subscription tier values */
export type SubscriptionTier = (typeof SubscriptionTier)[keyof typeof SubscriptionTier];
