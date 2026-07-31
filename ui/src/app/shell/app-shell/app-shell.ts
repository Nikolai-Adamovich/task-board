import { Component, afterNextRender, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Sidebar } from '../sidebar/sidebar';
import { PreferencesStore } from '../../stores/preferences-store';
import { AuthStore } from '../../stores/auth-store';

@Component({
  selector: 'ui-shell',
  imports: [RouterOutlet, Sidebar],
  templateUrl: './app-shell.html',
})
export class AppShell {
  private readonly preferencesStore = inject(PreferencesStore);
  private readonly authStore = inject(AuthStore);

  constructor() {
    afterNextRender(() => {
      if (this.authStore.isAuthenticated()) {
        this.preferencesStore.loadPreferences();
      }
    });
  }
}
