import { Component, booleanAttribute, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { lucideTriangleAlert } from '@ng-icons/lucide';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';

/**
 * Shared confirmation dialog (Spartan `hlm-dialog` composition).
 *
 * All strings are transloco keys. The optional message supports interpolation
 * params via `messageParams`.
 *
 * ```html
 * <ui-confirm-dialog
 *   [state]="showDeleteDialog()"
 *   titleKey="labelManager.deleteTitle"
 *   messageKey="labelManager.deleteConfirm"
 *   [messageParams]="{ name: deletingLabel()?.name }"
 *   [loading]="saving()"
 *   confirmLabelKey="common.delete"
 *   (confirmed)="deleteLabel()"
 *   (stateChanged)="showDeleteDialog.set($event)"
 * />
 * ```
 */
@Component({
  selector: 'ui-confirm-dialog',
  imports: [TranslocoPipe, HlmDialogImports, HlmButtonImports, HlmSpinnerImports],
  providers: [provideIcons({ lucideTriangleAlert })],
  templateUrl: './confirm-dialog.html',
})
export class ConfirmDialog {
  /** Open/closed state controlled by the parent. */
  readonly state = input(false, { transform: booleanAttribute });
  /** Transloco key for the dialog title. */
  readonly titleKey = input.required<string>();
  /** Interpolation params for the title key. */
  readonly titleParams = input<Record<string, unknown>>({});
  /** Transloco key for the confirmation message (rendered as the dialog description). */
  readonly messageKey = input<string | null>(null);
  /** Interpolation params for the message key. */
  readonly messageParams = input<Record<string, unknown>>({});
  /** Transloco key for the confirm button label. */
  readonly confirmLabelKey = input<string>('common.confirm');
  /** Transloco key for the cancel button label. */
  readonly cancelLabelKey = input<string>('common.cancel');
  /** Whether the confirm action is in flight (disables buttons, shows spinner). */
  readonly loading = input(false, { transform: booleanAttribute });
  /** Destructive styling for the confirm button (default true). */
  readonly destructive = input(true, { transform: booleanAttribute });
  /** Emits when the user confirms the action. */
  readonly confirmed = output();
  /** Emits the new open state when the dialog is closed via overlay/escape. */
  readonly stateChanged = output<boolean>();

  protected onStateChanged(state: string): void {
    this.stateChanged.emit(state === 'open');
  }
}
