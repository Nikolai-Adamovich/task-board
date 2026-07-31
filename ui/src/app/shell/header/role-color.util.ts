import { TenantRole } from '@task-board/shared';

export function getRoleColor(role: TenantRole | null): string {
  switch (role) {
    case TenantRole.Owner:
      return 'var(--role-owner)';

    case TenantRole.Admin:
      return 'var(--role-admin)';

    case TenantRole.Member:
      return 'var(--role-member)';

    default:
      return 'var(--border)';
  }
}
