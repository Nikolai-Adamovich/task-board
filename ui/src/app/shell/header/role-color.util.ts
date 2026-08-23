import { TenantRole } from '@task-board/shared';

export function getRoleColor(role: TenantRole | null): string {
  switch (role) {
    case TenantRole.OWNER:
      return 'var(--role-owner)';

    case TenantRole.ADMIN:
      return 'var(--role-admin)';

    case TenantRole.MEMBER:
      return 'var(--role-member)';

    default:
      return 'var(--border)';
  }
}
