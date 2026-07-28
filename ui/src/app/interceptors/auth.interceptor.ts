import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthStore } from '@stores/auth-store';

/**
 * Functional HTTP interceptor that attaches the JWT Bearer token
 * to all requests except /auth/* endpoints.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authStore = inject(AuthStore);
  const token = authStore.token();

  // Skip auth header for auth-related requests
  if (req.url.includes('/auth/')) {
    return next(req);
  }

  if (token) {
    const cloned = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });

    return next(cloned);
  }

  return next(req);
};
