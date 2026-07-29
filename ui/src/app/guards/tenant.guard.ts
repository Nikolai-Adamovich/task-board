import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TenantClient } from '@services/tenant-client';

/**
 * Functional route guard that ensures an active tenant is selected.
 * If the tenantId from the route doesn't match the active tenant, update it.
 *
 * After a page reload, tenants haven't been loaded yet. The guard therefore:
 * 1. If tenants are already loaded and a match is found → pass immediately.
 * 2. If tenants haven't been loaded yet → call `loadTenants()` and wait for
 *    the result. On success, check for a match. On error → redirect to /.
 * 3. No match in loaded tenants → redirect to /.
 */
export const tenantGuard: CanActivateFn = async (route) => {
  const tenantService = inject(TenantClient);
  const router = inject(Router);
  const tenantId = route.paramMap.get('tenantId');

  if (!tenantId) {
    return router.parseUrl('/');
  }

  // If tenants haven't been loaded yet (page reload), fetch them first
  if (tenantService.tenants().length === 0) {
    try {
      await firstValueFrom(tenantService.loadTenants());
    } catch {
      return router.parseUrl('/');
    }
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
