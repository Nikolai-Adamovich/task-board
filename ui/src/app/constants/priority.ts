/** Task priority levels with their corresponding Tailwind CSS color classes */
export const PriorityColorMap = {
  LOW: 'bg-blue-100 text-blue-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
} as const;

export type PriorityColorMap = (typeof PriorityColorMap)[keyof typeof PriorityColorMap];

/** Sprint status levels with their corresponding Tailwind CSS color classes */
export const StatusColorMap = {
  FUTURE: 'bg-blue-100 text-blue-700',
  ACTIVE: 'bg-green-100 text-green-700',
  COMPLETED: 'bg-gray-100 text-gray-600',
} as const;

export type StatusColorMap = (typeof StatusColorMap)[keyof typeof StatusColorMap];

/** Tenant role levels with their corresponding Tailwind CSS color classes */
export const TenantRoleColorMap = {
  OWNER: 'bg-purple-100 text-purple-700',
  ADMIN: 'bg-blue-100 text-blue-700',
  MEMBER: 'bg-gray-100 text-gray-600',
} as const;

export type TenantRoleColorMap = (typeof TenantRoleColorMap)[keyof typeof TenantRoleColorMap];

/** Member status levels with their corresponding Tailwind CSS color classes */
export const MemberStatusColorMap = {
  ACTIVE: 'bg-green-100 text-green-700',
  PENDING: 'bg-amber-100 text-amber-700',
  DECLINED: 'bg-red-100 text-red-700',
  ACCESS_REVOKED: 'bg-red-100 text-red-700',
} as const;

export type MemberStatusColorMap = (typeof MemberStatusColorMap)[keyof typeof MemberStatusColorMap];

/** Priority dot indicator colors for sprint-detail view */
export const PriorityDotColorMap = {
  LOW: 'bg-blue-500',
  MEDIUM: 'bg-yellow-500',
  HIGH: 'bg-orange-500',
  CRITICAL: 'bg-red-500',
} as const;

export type PriorityDotColorMap = (typeof PriorityDotColorMap)[keyof typeof PriorityDotColorMap];

/** Tenant status with their corresponding Tailwind CSS color classes */
export const TenantStatusColorMap = {
  ACTIVE: 'bg-green-100 text-green-700',
  ARCHIVED: 'bg-amber-100 text-amber-700',
  DELETION_PENDING: 'bg-red-100 text-red-700',
} as const;

export type TenantStatusColorMap = (typeof TenantStatusColorMap)[keyof typeof TenantStatusColorMap];

/** Project status with their corresponding Tailwind CSS color classes */
export const ProjectStatusColorMap = {
  ACTIVE: 'bg-green-100 text-green-700',
  ARCHIVED: 'bg-amber-100 text-amber-700',
  DELETION_PENDING: 'bg-red-100 text-red-700',
} as const;

export type ProjectStatusColorMap = (typeof ProjectStatusColorMap)[keyof typeof ProjectStatusColorMap];

/** Task-type badge colors keyed by task-type key (task/bug/story). Custom types fall back to neutral. */
export const TaskTypeColorMap = {
  TASK: 'bg-blue-100 text-blue-700',
  BUG: 'bg-red-100 text-red-700',
  STORY: 'bg-green-100 text-green-700',
} as const;

export type TaskTypeColorMap = (typeof TaskTypeColorMap)[keyof typeof TaskTypeColorMap];

/** Neutral fallback color for unknown values */
export const NeutralColor = 'bg-gray-100 text-gray-700';

/** Neutral fallback color for dot indicators */
export const NeutralDotColor = 'bg-gray-500';

/**
 * Badge class lookup shared by sprint, tenant, and project statuses.
 * Sprint (FUTURE/ACTIVE/COMPLETED) and tenant/project (ACTIVE/ARCHIVED/DELETION_PENDING)
 * values are merged — overlapping keys agree on the same color.
 */
const StatusBadgeColorMap: Record<string, string> = { ...StatusColorMap, ...TenantStatusColorMap };

/** Resolve the badge classes for a task priority. Unknown values fall back to {@link NeutralColor}. */
export function priorityBadgeClass(priority: string): string {
  return (PriorityColorMap as Record<string, string>)[priority] ?? NeutralColor;
}

/** Resolve the badge classes for a sprint/tenant/project status. Unknown values fall back to {@link NeutralColor}. */
export function statusBadgeClass(status: string): string {
  return StatusBadgeColorMap[status] ?? NeutralColor;
}

/** Resolve the badge classes for a tenant role. Unknown values fall back to {@link NeutralColor}. */
export function roleBadgeClass(role: string): string {
  return (TenantRoleColorMap as Record<string, string>)[role] ?? NeutralColor;
}

/** Resolve the badge classes for a tenant member status. Unknown values fall back to {@link NeutralColor}. */
export function memberStatusBadgeClass(status: string): string {
  return (MemberStatusColorMap as Record<string, string>)[status] ?? NeutralColor;
}

/** Resolve the badge classes for a task type by its key (task/bug/story). Unknown keys fall back to {@link NeutralColor}. */
export function taskTypeBadgeClass(key: string | null | undefined): string {
  if (!key) return NeutralColor;

  return (TaskTypeColorMap as Record<string, string>)[key.toUpperCase()] ?? NeutralColor;
}
