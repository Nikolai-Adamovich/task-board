import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TenantClient } from '../services/tenant-client';

/**
 * Functional HTTP interceptor that attaches the X-Tenant-Id header
 * to all requests except /auth/* endpoints.
 */
export const tenantInterceptor: HttpInterceptorFn = (req, next) => {
  // Skip tenant header for auth-related requests
  if (req.url.includes('/auth/')) {
    return next(req);
  }

  const tenantService = inject(TenantClient);
  const activeTenant = tenantService.activeTenant();

  if (activeTenant) {
    const cloned = req.clone({
      setHeaders: {
        'X-Tenant-Id': activeTenant.id,
      },
    });
    return next(cloned);
  }

  return next(req);
};
