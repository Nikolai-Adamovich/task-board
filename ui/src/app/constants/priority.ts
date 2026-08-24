/**
 * Semantic color mappings for badges and indicators.
 *
 * All badge maps resolve to Spartan `hlmBadge` variants (semantic theme tokens),
 * so styling automatically follows light/dark themes. Dot indicators use
 * semantic tokens with opacity gradation.
 */

/** Subset of `hlmBadge` variants used across the app. */
export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

/** Task priority levels mapped to badge variants (ascending severity). */
export const PriorityVariantMap = {
  LOW: 'outline',
  MEDIUM: 'secondary',
  HIGH: 'default',
  CRITICAL: 'destructive',
} as const;

/** Sprint status levels mapped to badge variants. */
export const StatusVariantMap = {
  FUTURE: 'secondary',
  ACTIVE: 'default',
  COMPLETED: 'outline',
} as const;

/** Tenant role levels mapped to badge variants. */
export const TenantRoleVariantMap = {
  OWNER: 'default',
  ADMIN: 'secondary',
  MEMBER: 'outline',
} as const;

/** Member status levels mapped to badge variants. */
export const MemberStatusVariantMap = {
  ACTIVE: 'default',
  PENDING: 'secondary',
  DECLINED: 'destructive',
  ACCESS_REVOKED: 'destructive',
} as const;

/** Priority dot indicator colors for sprint views (semantic tokens, ascending severity). */
export const PriorityDotColorMap = {
  LOW: 'bg-primary/40',
  MEDIUM: 'bg-primary/70',
  HIGH: 'bg-destructive/70',
  CRITICAL: 'bg-destructive',
} as const;

/** Tenant status mapped to badge variants. */
export const TenantStatusVariantMap = {
  ACTIVE: 'default',
  ARCHIVED: 'secondary',
  DELETION_PENDING: 'destructive',
} as const;

/** Project status mapped to badge variants. */
export const ProjectStatusVariantMap = {
  ACTIVE: 'default',
  ARCHIVED: 'secondary',
  DELETION_PENDING: 'destructive',
} as const;

/** Semantic hlm-badge variants keyed by task-type key (task/bug/story). Custom types fall back to outline. */
export const TaskTypeVariantMap = {
  TASK: 'default',
  BUG: 'destructive',
  STORY: 'secondary',
} as const;

export type TaskTypeVariant = (typeof TaskTypeVariantMap)[keyof typeof TaskTypeVariantMap] | 'outline';

/** Neutral fallback variant for unknown values */
export const NeutralVariant: BadgeVariant = 'outline';

/** Neutral fallback color for dot indicators */
export const NeutralDotColor = 'bg-muted-foreground';

/**
 * Badge variant lookup shared by sprint, tenant, and project statuses.
 * Sprint (FUTURE/ACTIVE/COMPLETED) and tenant/project (ACTIVE/ARCHIVED/DELETION_PENDING)
 * values are merged — overlapping keys agree on the same variant.
 */
const StatusBadgeVariantMap: Record<string, BadgeVariant> = { ...StatusVariantMap, ...TenantStatusVariantMap };

/** Resolve the badge variant for a task priority. Unknown values fall back to {@link NeutralVariant}. */
export function priorityBadgeVariant(priority: string): BadgeVariant {
  return (PriorityVariantMap as Record<string, BadgeVariant>)[priority] ?? NeutralVariant;
}

/** Resolve the badge variant for a sprint/tenant/project status. Unknown values fall back to {@link NeutralVariant}. */
export function statusBadgeVariant(status: string): BadgeVariant {
  return StatusBadgeVariantMap[status] ?? NeutralVariant;
}

/** Resolve the badge variant for a tenant role. Unknown values fall back to {@link NeutralVariant}. */
export function roleBadgeVariant(role: string): BadgeVariant {
  return (TenantRoleVariantMap as Record<string, BadgeVariant>)[role] ?? NeutralVariant;
}

/** Resolve the badge variant for a tenant member status. Unknown values fall back to {@link NeutralVariant}. */
export function memberStatusBadgeVariant(status: string): BadgeVariant {
  return (MemberStatusVariantMap as Record<string, BadgeVariant>)[status] ?? NeutralVariant;
}

/** Resolve the semantic badge variant for a task type by its key (task/bug/story). Unknown keys fall back to `'outline'`. */
export function taskTypeBadgeVariant(key: string | null | undefined): TaskTypeVariant {
  if (!key) return 'outline';

  return (TaskTypeVariantMap as Record<string, TaskTypeVariant>)[key.toUpperCase()] ?? 'outline';
}
