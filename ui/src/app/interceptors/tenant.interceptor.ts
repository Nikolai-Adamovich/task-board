import { HttpInterceptorFn } from '@angular/common/http';

const TENANT_KEY = 'taskboard_tenant_id';

/**
 * Functional HTTP interceptor that attaches the X-Tenant-Id header
 * to all requests except /auth/* endpoints.
 *
 * Reads tenant ID from localStorage to avoid circular dependency with TenantStore.
 * TenantStore.setActiveTenant() writes to localStorage, so this stays in sync.
 */
export const tenantInterceptor: HttpInterceptorFn = (req, next) => {
  // Skip tenant header for auth-related requests
  if (req.url.includes('/auth/')) {
    return next(req);
  }

  const tenantId = localStorage.getItem(TENANT_KEY);

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
