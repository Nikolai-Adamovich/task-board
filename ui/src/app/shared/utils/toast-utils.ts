import { inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { toast } from '@spartan-ng/brain/sonner';

/**
 * Toast helpers bound to the caller's `TranslocoService`.
 *
 * Must be called within an injection context (e.g. a component field initializer):
 *
 * ```ts
 * private readonly notify = injectToasts();
 * // …
 * this.notify.success('toasts.created');
 * ```
 */
export function injectToasts() {
  const transloco = inject(TranslocoService);

  return {
    /** Show a localized success toast. */
    success: (key: string, params?: Record<string, unknown>): void => {
      toast.success(transloco.translate(key, params));
    },
    /** Show a localized error toast. */
    error: (key: string, params?: Record<string, unknown>): void => {
      toast.error(transloco.translate(key, params));
    },
  };
}
