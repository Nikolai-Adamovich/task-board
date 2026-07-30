/** Tenant-level roles within an organization */
export const TenantRole = {
  Owner: 'owner',
  Admin: 'admin',
  Member: 'member',
} as const;

/** Union type of tenant role values */
export type TenantRole = (typeof TenantRole)[keyof typeof TenantRole];

/** Project-level roles for project members */
export const ProjectRole = ['admin', 'developer', 'viewer'] as const;

/** Task priority levels */
export const TaskPriority = ['low', 'medium', 'high', 'critical'] as const;

/** Sprint lifecycle statuses */
export const SprintStatus = ['planned', 'active', 'completed'] as const;

/** Member invitation/activation status */
export const MemberStatus = ['active', 'pending', 'declined', 'access_revoked'] as const;

/** Subscription tier levels */
export const SubscriptionTier = ['free', 'premium'] as const;
