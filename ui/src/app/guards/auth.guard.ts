import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '@stores/auth-store';
import { firstValueFrom } from 'rxjs';

/**
 * Functional route guard that redirects to /auth/login if not authenticated.
 *
 * After a page reload the JWT token is restored from localStorage
 * synchronously, but the current user still needs to be fetched via
 * /auth/me.  The guard therefore:
 *
 * 1. If `currentUser` is already loaded → pass immediately.
 * 2. If a token exists (restored from localStorage) but `currentUser`
 *    is not loaded yet → call `fetchCurrentUser()` and **wait** for the
 *    result.  On success → pass.  On 401 → redirect to login.
 * 3. No token at all → redirect to login.
 *
 * This prevents the race condition where `fetchCurrentUser()` fires
 * from the constructor, returns 401, calls `logout()` (clearing the
 * token), and the error interceptor navigates to /login — all before
 * the guard has finished.
 */
export const authGuard: CanActivateFn = async () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  // Fast path: user already fully loaded (e.g. after login without page reload)
  if (authStore.currentUser()) {
    return true;
  }

  // Token restored from localStorage but currentUser not fetched yet.
  // Call fetchCurrentUser and wait for the result before deciding.
  if (authStore.token()) {
    try {
      await firstValueFrom(authStore.fetchCurrentUser());
      return true;
    } catch {
      // fetchCurrentUser already called logout() on 401 → token cleared.
      // For other errors (network, 500) the token is preserved but we
      // still redirect to be safe.
      return router.parseUrl('/auth/login');
    }
  }

  // No token → not authenticated
  return router.parseUrl('/auth/login');
};
