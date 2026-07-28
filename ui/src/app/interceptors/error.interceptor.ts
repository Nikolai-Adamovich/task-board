import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

/**
 * Functional HTTP interceptor that handles error responses:
 * - 401 → redirect to /auth/login
 * - 403 → permission denied (throw error)
 * - 422 → validation errors (throw with details)
 * - Other → generic error
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      switch (error.status) {
        case 401:
          // Redirect to login on unauthorized
          router.navigate(['/auth/login']);
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
