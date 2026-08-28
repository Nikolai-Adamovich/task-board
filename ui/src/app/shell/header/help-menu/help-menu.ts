import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleHelp, lucideBookOpen, lucideKeyboard, lucideLifeBuoy } from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { KeyboardShortcuts } from '@app/shared/keyboard-shortcuts/keyboard-shortcuts';

@Component({
  selector: 'ui-help-menu',
  standalone: true,
  imports: [RouterLink, NgIcon, HlmButtonImports, HlmDropdownMenuImports, TranslocoPipe],
  providers: [provideIcons({ lucideCircleHelp, lucideBookOpen, lucideKeyboard, lucideLifeBuoy })],
  templateUrl: './help-menu.html',
})
export class HelpMenu {
  /** Root-provided — same instance the app shell's help dialog is bound to. */
  private readonly shortcuts = inject(KeyboardShortcuts);

  protected openHotkeys(): void {
    this.shortcuts.openHelp();
  }
}
