/** Task priority levels with their corresponding Tailwind CSS color classes */
export const PriorityColorMap = {
  low: 'bg-blue-100 text-blue-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
} as const;

export type PriorityColorMap = (typeof PriorityColorMap)[keyof typeof PriorityColorMap];

/** Sprint status levels with their corresponding Tailwind CSS color classes */
export const StatusColorMap = {
  planned: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  completed: 'bg-gray-100 text-gray-600',
} as const;

export type StatusColorMap = (typeof StatusColorMap)[keyof typeof StatusColorMap];

/** Tenant role levels with their corresponding Tailwind CSS color classes */
export const TenantRoleColorMap = {
  owner: 'bg-purple-100 text-purple-700',
  admin: 'bg-blue-100 text-blue-700',
  member: 'bg-gray-100 text-gray-600',
} as const;

export type TenantRoleColorMap = (typeof TenantRoleColorMap)[keyof typeof TenantRoleColorMap];

/** Member status levels with their corresponding Tailwind CSS color classes */
export const MemberStatusColorMap = {
  active: 'bg-green-100 text-green-700',
  pending: 'bg-amber-100 text-amber-700',
  declined: 'bg-red-100 text-red-700',
  access_revoked: 'bg-red-100 text-red-700',
} as const;

export type MemberStatusColorMap = (typeof MemberStatusColorMap)[keyof typeof MemberStatusColorMap];

/** Priority dot indicator colors for sprint-detail view */
export const PriorityDotColorMap = {
  low: 'bg-blue-500',
  medium: 'bg-yellow-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500',
} as const;

export type PriorityDotColorMap = (typeof PriorityDotColorMap)[keyof typeof PriorityDotColorMap];

/** Neutral fallback color for unknown values */
export const NeutralColor = 'bg-gray-100 text-gray-700';

/** Neutral fallback color for dot indicators */
export const NeutralDotColor = 'bg-gray-500';
