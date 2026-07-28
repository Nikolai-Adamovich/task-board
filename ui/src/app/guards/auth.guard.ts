import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '@stores/auth-store';

/**
 * Functional route guard that redirects to /auth/login if not authenticated.
 */
export const authGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (authStore.isAuthenticated()) {
    return true;
  }

  return router.parseUrl('/auth/login');
};
