import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from './shell/header/header';
import { PreferencesStore } from './stores/preferences-store';

@Component({
  selector: 'ui-root',
  imports: [RouterOutlet, Header],
  templateUrl: './app.html',
})
export class App {
  constructor() {
    // Eagerly inject the store to trigger its constructor,
    // which restores the theme from localStorage before first paint.
    // TODO: check if this is needed to prevent blinking when changing theme
    inject(PreferencesStore);
  }
}
