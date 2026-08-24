import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import { toast } from '@spartan-ng/brain/sonner';
import { AuthStore } from '@stores/auth-store';
import type { ErrorResponse } from '@task-board/shared';

/** Map of error codes to user-friendly message keys */
const ERROR_CODE_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: 'errors.validation',
  NOT_FOUND: 'errors.notFound',
  TASK_VERSION_CONFLICT: 'errors.taskVersionConflict',
  UNAUTHORIZED: 'errors.unauthorized',
  FORBIDDEN: 'errors.forbidden',
  CONFLICT: 'errors.conflict',
  INTERNAL_ERROR: 'errors.serverError',
  EMAIL_ALREADY_EXISTS: 'errors.emailAlreadyExists',
  INVALID_CREDENTIALS: 'errors.invalidCredentials',
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
      if (error.status === 0 || error.status >= 500) {
        toast.error(transloco.translate(userMessage));
      }

      switch (error.status) {
        case 401:
          authStore.logout();
          break;

        case 403:
          console.error('Permission denied:', userMessage);
          break;

        case 409:
          console.error('Conflict:', userMessage);
          break;

        case 422:
          console.error('Validation error:', (error.error as ErrorResponse)?.error?.details ?? userMessage);
          break;
      }

      return throwError(() => error);
    }),
  );
};
