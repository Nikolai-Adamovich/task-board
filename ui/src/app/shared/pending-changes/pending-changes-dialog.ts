import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { PendingChangesService } from './pending-changes.service';

/**
 * P13b (Fix 4): the UI half of the unsaved-changes confirmation — a thin
 * hlm-dialog bound to {@link PendingChangesService.open}. Rendered ONCE in the
 * app shell; the `pendingChangesGuard` drives it through the service's
 * promise-based `confirm()`.
 */
@Component({
  selector: 'ui-pending-changes-dialog',
  imports: [TranslocoPipe, HlmDialogImports, HlmButtonImports],
  templateUrl: './pending-changes-dialog.html',
})
export class PendingChangesDialog {
  protected readonly pending = inject(PendingChangesService);
}
