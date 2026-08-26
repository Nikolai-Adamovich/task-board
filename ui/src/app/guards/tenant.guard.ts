import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { TenantStore } from '@stores/tenant-store';
import { AuthStore } from '@stores/auth-store';
import { ProjectStore } from '@stores/project-store';

/**
 * Functional route guard that ensures an active tenant is selected.
 * Resolves the tenant by its URL **slug** (`/t/:tenantSlug`, DEC-032).
 *
 * After a page reload, tenants haven't been loaded yet. The guard therefore:
 * 1. If tenants are already loaded and a match is found → pass immediately.
 * 2. If tenants haven't been loaded yet → call `loadTenants()` and wait for
 *    the result. On success, check for a match. On error → redirect to /.
 * 3. No match in loaded tenants → redirect to /.
 *
 * Switching to a different tenant clears the project context (IA §2.1).
 */
export const tenantGuard: CanActivateFn = async (route) => {
  const tenantStore = inject(TenantStore);
  const authStore = inject(AuthStore);
  const projectStore = inject(ProjectStore);
  const router = inject(Router);
  const tenantSlug = route.paramMap.get('tenantSlug');

  if (!tenantSlug) {
    return router.parseUrl('/');
  }

  // If tenants haven't been loaded yet (page reload), fetch them first
  if (tenantStore.tenants().length === 0) {
    try {
      await tenantStore.loadTenants();
    } catch {
      return router.parseUrl('/');
    }
  }

  const activeTenant = tenantStore.activeTenant();

  // If no active tenant or tenant mismatch, try to find from loaded tenants
  if (!activeTenant || activeTenant.slug !== tenantSlug) {
    const tenants = tenantStore.tenants();
    const match = tenants.find((t) => t.slug === tenantSlug);

    if (match) {
      tenantStore.setActiveTenant(match);
      authStore.setTenantRole(match.role);
      projectStore.clearProject();
      return true;
    }

    return router.parseUrl('/');
  }

  // Active tenant matches — ensure AuthStore has the role
  authStore.setTenantRole(activeTenant.role);
  return true;
};
