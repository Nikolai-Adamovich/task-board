import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HlmToasterImports } from '@spartan-ng/helm/sonner';
import { Header } from './shell/header/header';
import { PreferencesStore } from './stores/preferences-store';

@Component({
  selector: 'ui-root',
  imports: [RouterOutlet, Header, HlmToasterImports],
  templateUrl: './app.html',
})
export class App {
  // Eagerly injected so the store constructor runs before first paint,
  // restoring the theme from localStorage and preventing a theme flash.
  protected readonly preferencesStore = inject(PreferencesStore);
}
