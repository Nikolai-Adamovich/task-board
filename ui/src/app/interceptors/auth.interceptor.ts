import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthStore } from '@stores/auth-store';

/**
 * Functional HTTP interceptor that attaches the JWT Bearer token
 * to all requests except login/register endpoints.
 *
 * Note: /auth/me IS skipped from the skip-list because it requires
 * the Bearer token to identify the current user.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authStore = inject(AuthStore);
  const token = authStore.token();

  // Skip auth header only for login/register (they don't have a token yet).
  // /auth/me must receive the token — it's used to restore the session after reload.
  if (req.url.includes('/auth/login') || req.url.includes('/auth/register')) {
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
