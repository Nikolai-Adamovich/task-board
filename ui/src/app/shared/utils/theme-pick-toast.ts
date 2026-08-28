import { inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { toast } from '@spartan-ng/brain/sonner';
import { ToastAlertIcon } from '@app/shared/toast-alert-icon/toast-alert-icon';

/**
 * Toast helpers for theme picking, bound to the caller's `TranslocoService`.
 *
 * Must be called within an injection context (e.g. a component field initializer):
 *
 * ```ts
 * private readonly themeToasts = injectThemePickToasts();
 * // …
 * this.themeToasts.warnIfDeferred(themeId, mode, this.preferencesStore.effectiveTheme());
 * ```
 */
export function injectThemePickToasts() {
  const transloco = inject(TranslocoService);

  return {
    /**
     * Neutral warning for a "hidden" theme pick: shown when the picked
     * theme will NOT become the applied theme right now — e.g. in Auto mode
     * when the picked theme's mode differs from the current browser scheme.
     * No-op when the pick is applied immediately (normal case).
     *
     * Uses `toast.warning` (renders neutral without richColors) + the alert icon.
     */
    warnIfDeferred: (themeId: string, mode: 'light' | 'dark', effectiveThemeId: string): void => {
      if (effectiveThemeId === themeId) return;

      const modeLabel = transloco.translate(mode === 'light' ? 'themes.modeLight' : 'themes.modeDark');

      toast.warning(transloco.translate('themes.deferredToast', { mode: modeLabel }), {
        icon: ToastAlertIcon,
      });
    },
  };
}
