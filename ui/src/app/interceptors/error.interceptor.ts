import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthStore } from '@stores/auth-store';

/**
 * Functional HTTP interceptor that handles error responses:
 * - 401 → clear auth state and redirect to /auth/login
 * - 403 → permission denied (throw error)
 * - 422 → validation errors (throw with details)
 * - Other → generic error
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const authStore = inject(AuthStore);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      switch (error.status) {
        case 401:
          authStore.logout();
          break;

        case 403:
          console.error(
            'Permission denied:',
            error.error?.message ?? 'You do not have permission to perform this action',
          );
          break;

        case 422:
          console.error('Validation error:', error.error?.details ?? error.error?.message);
          break;
      }

      return throwError(() => error);
    }),
  );
};
