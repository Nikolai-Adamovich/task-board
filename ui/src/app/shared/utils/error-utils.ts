import { HttpErrorResponse } from '@angular/common/http';

/**
 * Shared error-message extraction used across the app.
 *
 * The HTTP error interceptor attaches a normalized `userMessage` (a transloco key)
 * to every `HttpErrorResponse`. This helper prefers that attached key so the UI can
 * localize the message, falling back to the raw payload/message and finally to a
 * generic transloco key.
 *
 * @param err - The caught error value.
 * @param fallbackKey - Transloco key used when no more specific message is available.
 * @returns A transloco key (or raw message) safe to pass through the transloco pipe.
 */
export function getErrorMessage(err: unknown, fallbackKey = 'errors.unexpected'): string {
  if (err instanceof HttpErrorResponse) {
    const userMessage = (err as HttpErrorResponse & { userMessage?: string }).userMessage;

    if (userMessage) return userMessage;

    return err.error?.message ?? err.message ?? fallbackKey;
  }

  if (err instanceof Error) {
    return err.message || fallbackKey;
  }

  return fallbackKey;
}

/**
 * Derive an avatar fallback (initials) from a display name.
 * Returns a two-character uppercase string, e.g. "Jane Doe" → "JD".
 *
 * @param name - The display name (or null when the user has no name).
 */
export function initials(name: string | null): string {
  if (!name) return '??';

  const parts = name.trim().split(/\s+/);

  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  return name.substring(0, 2).toUpperCase();
}
