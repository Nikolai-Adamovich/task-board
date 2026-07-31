import { Component, inject, model } from '@angular/core';
import { ExpandState, Theme } from '@task-board/shared';
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
  protected readonly open = model<ExpandState>(ExpandState.Closed);
  protected readonly Theme = Theme;

  protected selectTheme(theme: Theme): void {
    this.preferencesStore.setTheme(theme);
    this.open.set(ExpandState.Closed);
  }
}
