import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TenantStore } from '@stores/tenant-store';

/**
 * Functional HTTP interceptor that attaches the X-Tenant-Id header
 * to all requests except /auth/* endpoints.
 *
 * Uses TenantStore to get the active tenant ID, ensuring consistency
 * with the store's state management.
 */
export const tenantInterceptor: HttpInterceptorFn = (req, next) => {
  // Skip tenant header for auth-related requests
  if (req.url.includes('/auth/')) {
    return next(req);
  }

  const tenantStore = inject(TenantStore);
  const tenantId = tenantStore.activeTenant()?.id;

  if (tenantId) {
    const cloned = req.clone({
      setHeaders: {
        'X-Tenant-Id': tenantId,
      },
    });

    return next(cloned);
  }

  return next(req);
};
