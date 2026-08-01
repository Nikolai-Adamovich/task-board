import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthStore } from '@stores/auth-store';

/**
 * Functional HTTP interceptor that attaches the JWT Bearer token
 * to all requests except login/register endpoints.
 *
 * Note: /auth/me IS NOT skipped — it requires the Bearer token
 * to identify the current user.
 */
const AUTH_ENDPOINTS_TO_SKIP = ['/auth/login', '/auth/register'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authStore = inject(AuthStore);
  const token = authStore.token();
  // Skip auth header only for login/register (they don't have a token yet).
  const skipEndpoint = AUTH_ENDPOINTS_TO_SKIP.some((endpoint) => req.url.includes(endpoint));

  if (skipEndpoint) {
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
