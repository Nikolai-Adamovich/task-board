import { ProjectRole, TenantRole } from '@task-board/shared';

/**
 * Role hierarchy for project-level permissions.
 * PROJECT_ADMIN > EDITOR > VIEWER
 */
const PROJECT_ROLE_HIERARCHY: Record<string, number> = {
  [ProjectRole.PROJECT_ADMIN]: 3,
  [ProjectRole.EDITOR]: 2,
  [ProjectRole.VIEWER]: 1,
};
/**
 * Tenant role hierarchy.
 * OWNER > ADMIN > MEMBER
 */
const TENANT_ROLE_HIERARCHY: Record<string, number> = {
  [TenantRole.OWNER]: 3,
  [TenantRole.ADMIN]: 2,
  [TenantRole.MEMBER]: 1,
};

/**
 * Check if a tenant role meets the minimum required level.
 */
export function hasMinTenantRole(currentRole: string | null, minRole: string): boolean {
  if (!currentRole) return false;

  return (TENANT_ROLE_HIERARCHY[currentRole] ?? 0) >= (TENANT_ROLE_HIERARCHY[minRole] ?? 0);
}

/**
 * Check if a project role meets the minimum required level.
 */
export function hasMinProjectRole(currentRole: string | null, minRole: string): boolean {
  if (!currentRole) return false;

  return (PROJECT_ROLE_HIERARCHY[currentRole] ?? 0) >= (PROJECT_ROLE_HIERARCHY[minRole] ?? 0);
}

/**
 * Check if the current user can write (not VIEWER).
 * Editors, Project Admins, and Tenant Admins/Owners can write.
 */
export function canWrite(projectRole: string | null, tenantRole: string | null): boolean {
  // Tenant owners/admins always have write access
  if (hasMinTenantRole(tenantRole, TenantRole.ADMIN)) return true;

  return hasMinProjectRole(projectRole, ProjectRole.EDITOR);
}

/**
 * Check if the current user can manage project settings (PROJECT_ADMIN+).
 */
export function canManageProject(projectRole: string | null, tenantRole: string | null): boolean {
  if (hasMinTenantRole(tenantRole, TenantRole.ADMIN)) return true;

  return hasMinProjectRole(projectRole, ProjectRole.PROJECT_ADMIN);
}
