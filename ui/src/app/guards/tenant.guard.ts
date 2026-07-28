import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { TenantClient } from '@services/tenant-client';

/**
 * Functional route guard that ensures an active tenant is selected.
 * If the tenantId from the route doesn't match the active tenant, update it.
 */
export const tenantGuard: CanActivateFn = (route) => {
  const tenantService = inject(TenantClient);
  const router = inject(Router);
  const tenantId = route.paramMap.get('tenantId');

  if (!tenantId) {
    return router.parseUrl('/');
  }

  const activeTenant = tenantService.activeTenant();

  // If no active tenant or tenant mismatch, try to find from loaded tenants
  if (!activeTenant || activeTenant.id !== tenantId) {
    const tenants = tenantService.tenants();
    const match = tenants.find((t) => t.id === tenantId);

    if (match) {
      tenantService.setActiveTenant(match);
      return true;
    }

    return router.parseUrl('/');
  }

  return true;
};
