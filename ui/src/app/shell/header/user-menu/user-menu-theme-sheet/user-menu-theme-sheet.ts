import { Component, inject, model } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmSheetImports } from '@spartan-ng/helm/sheet';
import { PreferencesStore } from '@stores/preferences-store';

@Component({
  selector: 'ui-user-menu-theme-sheet',
  standalone: true,
  imports: [HlmSheetImports, HlmButtonImports],
  templateUrl: './user-menu-theme-sheet.html',
})
export class UserMenuThemeSheet {
  protected readonly preferencesStore = inject(PreferencesStore);
  protected readonly open = model<'open' | 'closed'>('closed');

  protected selectTheme(theme: 'light' | 'dark'): void {
    this.preferencesStore.setTheme(theme);
    this.open.set('closed');
  }
}
