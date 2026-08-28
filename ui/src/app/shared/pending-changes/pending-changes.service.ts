import { Service, signal } from '@angular/core';

/**
 * P13b (Fix 4): promise-based "unsaved changes" confirmation.
 *
 * The `pendingChangesGuard` calls {@link confirm} when the user tries to leave
 * a page with pending changes; the returned promise resolves `true` (leave) or
 * `false` (stay). The actual dialog UI is the tiny {@link PendingChangesDialog}
 * rendered ONCE in the app shell and bound to this service's `open` signal —
 * the service itself never touches the DOM.
 *
 * Provided in the root injector so the guard, the dialog and any page component
 * share the same instance.
 */
@Service()
export class PendingChangesService {
  /** Whether the confirmation dialog is currently shown. */
  readonly open = signal(false);
  /** Pending resolver of the in-flight {@link confirm} call. */
  private resolver: ((leave: boolean) => void) | null = null;

  /**
   * Ask the user whether to leave with unsaved changes.
   * Resolves `true` when the user confirms leaving, `false` when they stay
   * (or when the dialog is dismissed via Esc/overlay click).
   */
  confirm(): Promise<boolean> {
    // A confirmation is already in flight — treat a second request as "stay"
    // so a double navigation can never silently discard changes.
    if (this.open()) return Promise.resolve(false);

    this.open.set(true);

    return new Promise((resolve) => {
      this.resolver = resolve;
    });
  }

  /** User picked "Leave" — navigation proceeds. */
  leave(): void {
    this.settle(true);
  }

  /** User picked "Stay" (or dismissed the dialog) — navigation is cancelled. */
  stay(): void {
    this.settle(false);
  }

  private settle(leave: boolean): void {
    this.open.set(false);

    const resolve = this.resolver;

    this.resolver = null;
    resolve?.(leave);
  }
}
