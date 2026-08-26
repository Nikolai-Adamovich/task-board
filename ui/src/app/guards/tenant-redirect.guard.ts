import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { TenantStore } from '@stores/tenant-store';

/**
 * Redirect guard for the legacy `/tenants/:tenantId` URLs (pre DEC-032 scheme).
 *
 * Resolves the legacy path segment (a tenant id **or** slug) against the
 * user's tenant list and redirects to the canonical `/t/:tenantSlug` home.
 * Unknown tenants fall back to the root entry.
 */
export const tenantRedirectGuard: CanActivateFn = async (route) => {
  const tenantStore = inject(TenantStore);
  const router = inject(Router);
  const ref = route.paramMap.get('tenantId');

  if (!ref) {
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

  const match = tenantStore.tenants().find((t) => t.id === ref || t.slug === ref);

  return match ? router.parseUrl(`/t/${match.slug}`) : router.parseUrl('/');
};
