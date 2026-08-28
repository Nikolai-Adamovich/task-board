import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { Sidebar } from '../sidebar/sidebar';
import { KeyboardShortcuts } from '@app/shared/keyboard-shortcuts/keyboard-shortcuts';
import { PendingChangesDialog } from '@app/shared/pending-changes/pending-changes-dialog';

@Component({
  selector: 'ui-shell',
  imports: [RouterOutlet, Sidebar, TranslocoPipe, HlmButtonImports, HlmDialogImports, PendingChangesDialog],
  templateUrl: './app-shell.html',
})
export class AppShell {
  /** Q9 (RQ-04 ②): global keyboard shortcuts + the `?` help dialog state */
  protected readonly shortcuts = inject(KeyboardShortcuts);
}
