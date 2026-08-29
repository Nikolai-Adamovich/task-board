import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import { AuthStore } from '@stores/auth-store';
import type { ErrorResponse } from '@task-board/shared';

/** Map of error codes (see `ErrorCode` in @task-board/shared) to message keys */
const ERROR_CODE_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: 'errors.validation',
  NOT_FOUND: 'errors.notFound',
  // V1-8: a failed login must show neutral invalid-credentials copy, not the
  // session-expired message mapped from the bare 401 status below.
  INVALID_CREDENTIALS: 'errors.invalidCredentials',
  TASK_VERSION_CONFLICT: 'errors.taskVersionConflict',
  UNAUTHORIZED: 'errors.unauthorized',
  FORBIDDEN: 'errors.forbidden',
  CONFLICT: 'errors.conflict',
  INTERNAL_ERROR: 'errors.serverError',
  DUPLICATE_PROJECT_KEY: 'errors.duplicateProjectKey',
  DUPLICATE_LABEL: 'errors.duplicateLabel',
  DUPLICATE_STATUS: 'errors.duplicateStatus',
  INVALID_STATUS_REPLACEMENT: 'errors.invalidStatusReplacement',
  INVALID_SPRINT_DATES: 'errors.invalidSprintDates',
  INVITATION_EXPIRED: 'errors.invitationExpired',
  INVITATION_REVOKED: 'errors.invitationRevoked',
  INVITATION_ALREADY_ACCEPTED: 'errors.invitationAlreadyAccepted',
  PROJECT_ARCHIVED: 'errors.projectArchived',
  TENANT_ARCHIVED: 'errors.tenantArchived',
  PROJECT_KEY_IMMUTABLE: 'errors.projectKeyImmutable',
  TASK_TYPE_IN_USE: 'errors.taskTypeInUse',
  STATUS_IN_USE: 'errors.statusInUse',
  SLUG_TAKEN: 'errors.slugTaken',
};

/** Extract a user-friendly message from a structured error response */
function extractErrorMessage(error: HttpErrorResponse): string {
  // Network errors (no response received) — e.g. "Failed to fetch"
  if (error.status === 0) {
    return 'errors.networkError';
  }

  const body = error.error as ErrorResponse | undefined;

  if (body?.error?.code) {
    return ERROR_CODE_MESSAGES[body.error.code] ?? body.error.message ?? 'errors.unknown';
  }

  if (body?.error?.message) {
    return body.error.message;
  }

  if (typeof error.error === 'string') {
    return error.error;
  }

  // Map common HTTP status codes to user-friendly messages
  switch (error.status) {
    case 400:
      return 'errors.badRequest';

    case 401:
      return 'errors.unauthorized';

    case 403:
      return 'errors.forbidden';

    case 404:
      return 'errors.notFound';

    case 409:
      return 'errors.conflict';

    case 422:
      return 'errors.validation';

    case 429:
      return 'errors.tooManyRequests';

    case 500:
      return 'errors.serverError';

    case 502:
      return 'errors.serverError';

    case 503:
      return 'errors.serverError';

    default:
      return 'errors.unexpected';
  }
}

/**
 * Functional HTTP interceptor that handles error responses:
 * - 401 → clear auth state and redirect to /auth/login
 * - 403 → permission denied
 * - 409 → conflict (e.g. TASK_VERSION_CONFLICT)
 * - 422 → validation errors
 * - Other → generic error
 *
 * All errors are re-thrown with a normalized `userMessage` property
 * attached to the HttpErrorResponse for downstream consumers.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const authStore = inject(AuthStore);
  const transloco = inject(TranslocoService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const userMessage = extractErrorMessage(error);

      // Attach the user-friendly message for downstream error handlers
      (error as HttpErrorResponse & { userMessage?: string }).userMessage = userMessage;

      // Surface unexpected errors (network failures / server errors) as toasts.
      // Expected client errors (4xx) are handled inline by the calling component.
      // P14 (item 32): brn-sonner is loaded via dynamic import — a static
      // import here would pin the whole ~49 kB module into the initial bundle
      // (the deferred <hlm-toaster> shares the same module file).
      if (error.status === 0 || error.status >= 500) {
        void import('@spartan-ng/brain/sonner').then(({ toast }) => toast.error(transloco.translate(userMessage)));
      }

      // Auto-logout on 401 — but NOT for auth endpoints themselves:
      // a failed login attempt returns 401 INVALID_CREDENTIALS and must not
      // wipe the session or trigger a redundant navigation.
      const isAuthRequest = req.url.includes('/auth/');

      switch (error.status) {
        case 401:
          if (!isAuthRequest) {
            authStore.logout();
          }
          break;

        // 403/409/422 are EXPECTED client errors — the calling component handles
        // them inline (toast/inline message) after the re-throw below; logging
        // them here was console-only noise with no user-facing value.
      }

      return throwError(() => error);
    }),
  );
};
