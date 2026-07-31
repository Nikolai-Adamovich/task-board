import type { TenantRole } from '@task-board/shared';

export function getRoleColor(role: TenantRole | null): string {
  switch (role) {
    case 'owner':
      return 'var(--role-owner)';

    case 'admin':
      return 'var(--role-admin)';

    case 'member':
      return 'var(--role-member)';

    default:
      return 'var(--border)';
  }
}
