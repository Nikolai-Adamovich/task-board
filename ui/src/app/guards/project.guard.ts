import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { TenantStore } from '@stores/tenant-store';

/**
 * Functional route guard that ensures a valid project context.
 * Verifies tenantId is present and active tenant matches.
 */
export const projectGuard: CanActivateFn = (route) => {
  const tenantStore = inject(TenantStore);
  const router = inject(Router);
  const tenantId = route.paramMap.get('tenantId');
  const projectId = route.paramMap.get('projectId');

  if (!tenantId || !projectId) {
    return router.parseUrl('/');
  }

  const activeTenant = tenantStore.activeTenant();

  if (!activeTenant || activeTenant.id !== tenantId) {
    return router.parseUrl('/');
  }

  return true;
};
