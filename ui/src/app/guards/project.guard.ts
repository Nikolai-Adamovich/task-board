import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { TenantStore } from '@stores/tenant-store';
import { AuthStore } from '@stores/auth-store';
import { ProjectStore } from '@stores/project-store';
import { TenantRole } from '@task-board/shared';
import type { TenantRole as TenantRoleType, ProjectRole } from '@task-board/shared';

/** Tenant-level roles that can bypass project membership checks */
const BYPASS_TENANT_ROLES: TenantRoleType[] = [TenantRole.OWNER, TenantRole.ADMIN];

/**
 * Functional route guard that ensures the user has access to a project.
 *
 * The tenant is resolved by slug from the `/t/:tenantSlug` URL prefix (DEC-032);
 * the project is resolved by its human-readable key.
 *
 * Access is granted when:
 * 1. The user's tenant role is OWNER or ADMIN (bypass — stores PROJECT_ADMIN), OR
 * 2. The user has a project membership with PROJECT_ADMIN, EDITOR, or VIEWER role.
 *
 * The guard also loads the project context and resolves the project role.
 */
export const projectGuard: CanActivateFn = async (route) => {
  const tenantStore = inject(TenantStore);
  const authStore = inject(AuthStore);
  const projectStore = inject(ProjectStore);
  const router = inject(Router);
  const tenantSlug = route.paramMap.get('tenantSlug');
  const projectKey = route.paramMap.get('projectKey');

  if (!tenantSlug || !projectKey) {
    return router.parseUrl('/');
  }

  const activeTenant = tenantStore.activeTenant();

  if (!activeTenant || activeTenant.slug !== tenantSlug) {
    return router.parseUrl('/');
  }

  // Load project context by key within the active tenant
  try {
    await projectStore.loadProjectByKey(activeTenant.id, projectKey);
  } catch {
    // Project not found or inaccessible — clear and redirect
    projectStore.clearProject();
    return router.parseUrl('/');
  }

  // Tenant OWNER/ADMIN can access any project within their tenant
  const tenantRole = authStore.tenantRole();

  if (tenantRole && BYPASS_TENANT_ROLES.includes(tenantRole)) {
    projectStore.setProjectRole('PROJECT_ADMIN' as ProjectRole);
    return true;
  }

  // For tenant MEMBERS, the project role is resolved from membership
  // The API will return 403 if the user has no access
  if (tenantRole === TenantRole.MEMBER) {
    // Project role is loaded from members list inside loadProject()
    // If user has no membership, API calls will return 403
    return true;
  }

  // No valid tenant role — redirect
  projectStore.clearProject();
  return router.parseUrl('/');
};
