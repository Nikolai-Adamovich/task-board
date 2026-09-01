import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '@stores/auth-store';

/**
 * Functional route guard that redirects to /auth/login if not authenticated.
 *
 * After a page reload the JWT token is restored from localStorage
 * synchronously, but the session state (current user + tenant list) still
 * needs to be fetched.  The guard therefore:
 *
 * 1. If the session is already bootstrapped (user loaded AND tenants
 *    initialized) → pass immediately.
 * 2. If a token exists (restored from localStorage) but the session is not
 *    initialized yet → call `bootstrap()` (ONE round-trip for user + tenants,
 *    replacing the sequential /auth/me → /tenants waterfall) and **wait** for
 *    the result.  On success → pass.  On 401 → redirect to login.
 * 3. No token at all → redirect to login.
 *
 * This prevents the race condition where the bootstrap call fires
 * from the constructor, returns 401, calls `logout()` (clearing the
 * token), and the error interceptor navigates to /login — all before
 * the guard has finished.
 */
export const authGuard: CanActivateFn = async () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  // Fast path: session already fully initialized (e.g. after login without
  // a page reload — bootstrap may still be pending for the tenant list).
  if (authStore.currentUser()) {
    return true;
  }

  // Token restored from localStorage but the session is not bootstrapped yet.
  // Call bootstrap and wait for the result before deciding.
  if (authStore.token()) {
    try {
      await authStore.bootstrap();
      return true;
    } catch {
      // bootstrap already triggered logout() on 401 → token cleared.
      // For other errors (network, 500) the token is preserved but we
      // still redirect to be safe.
      return router.parseUrl('/auth/login');
    }
  }

  // No token → not authenticated
  return router.parseUrl('/auth/login');
};
