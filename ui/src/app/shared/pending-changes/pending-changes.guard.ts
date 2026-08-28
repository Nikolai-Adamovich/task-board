import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { PendingChangesService } from './pending-changes.service';

/**
 * A page with potentially unsaved changes. Implemented by route components
 * (e.g. the create-task page) and checked by {@link pendingChangesGuard}.
 */
export interface PendingChanges {
  /** True when the user modified anything that would be lost on navigation. */
  hasPendingChanges(): boolean;
}

/**
 * P13b (Fix 4): functional `canDeactivate` guard. When the component reports
 * pending changes, show the shared confirmation dialog and only proceed on
 * "Leave". Runs in an injection context, so `inject()` is safe here.
 *
 * ```ts
 * {
 *   path: 'tasks/new',
 *   canDeactivate: [pendingChangesGuard],
 *   loadComponent: () => import('…').then((m) => m.TaskCreate),
 * }
 * ```
 */
export const pendingChangesGuard: CanDeactivateFn<PendingChanges> = async (component) => {
  // Component not yet created (or not implementing the interface) → nothing to lose.
  if (!component?.hasPendingChanges()) return true;

  return inject(PendingChangesService).confirm();
};
