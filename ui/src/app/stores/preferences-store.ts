import { Service, signal, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Theme } from '@task-board/shared';
import { UserPreferencesClient } from '@services/user-preferences-client';
import { AuthStore } from '@stores/auth-store';
import type { UserPreferences, UpdateUserPreferences } from '@task-board/shared';

const THEME_KEY = 'taskboard_theme';
const ZOOM_SAVE_DELAY_MS = 5_000;

/**
 * Signal-based preferences store.
 * Manages per-user UI settings: zoom, theme, and language.
 * Uses UserPreferencesClient for all HTTP calls — the store only handles orchestration and state.
 */
@Service()
export class PreferencesStore {
  private readonly client = inject(UserPreferencesClient);
  private readonly authStore = inject(AuthStore);
  readonly zoom = signal<number>(100);
  readonly theme = signal<Theme>(Theme.Light);
  readonly language = signal<string>('en');
  private zoomDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.restoreThemeFromLocalStorage();
  }

  /** Restore theme preference from localStorage and apply the CSS class immediately. */
  restoreThemeFromLocalStorage(): void {
    const stored = localStorage.getItem(THEME_KEY);

    if (stored === Theme.Dark) {
      this.theme.set(Theme.Dark);
      document.documentElement.classList.add(Theme.Dark);
    }
  }

  /** Load preferences from the backend and apply all settings. */
  async loadPreferences(): Promise<void> {
    const userId = this.authStore.currentUser()?.id;

    if (!userId) return;

    const prefs = await firstValueFrom(this.client.getPreferences(userId));

    this.applyPreferences(prefs);
  }

  /** Set zoom level, apply CSS, and schedule a debounced backend save. */
  setZoom(value: number): void {
    this.zoom.set(value);
    document.documentElement.style.setProperty('--zoom', String(value / 100));
    this.scheduleZoomSave();
  }

  /** Set theme, toggle CSS class, sync localStorage, and save immediately to backend. */
  setTheme(theme: Theme): void {
    this.theme.set(theme);

    if (theme === Theme.Dark) {
      document.documentElement.classList.add(Theme.Dark);
    } else {
      document.documentElement.classList.remove(Theme.Dark);
    }

    localStorage.setItem(THEME_KEY, theme);
    this.saveToBackend({ theme });
  }

  /** Set language (UI-only, no backend persistence). */
  setLanguage(language: string): void {
    this.language.set(language);
  }

  /** Apply all preference values from a backend response. */
  private applyPreferences(prefs: UserPreferences): void {
    this.zoom.set(prefs.zoom);
    this.theme.set(prefs.theme);
    this.language.set(prefs.language);

    document.documentElement.style.setProperty('--zoom', String(prefs.zoom / 100));

    if (prefs.theme === Theme.Dark) {
      document.documentElement.classList.add(Theme.Dark);
    } else {
      document.documentElement.classList.remove(Theme.Dark);
    }

    localStorage.setItem(THEME_KEY, prefs.theme);
  }

  /** Clear existing debounce timer and schedule a new 5-second zoom save. */
  private scheduleZoomSave(): void {
    if (this.zoomDebounceTimer !== null) {
      clearTimeout(this.zoomDebounceTimer);
    }

    this.zoomDebounceTimer = setTimeout(() => {
      this.zoomDebounceTimer = null;
      this.saveToBackend({ zoom: this.zoom() });
    }, ZOOM_SAVE_DELAY_MS);
  }

  /** Persist a partial preferences update to the backend. */
  private saveToBackend(data: UpdateUserPreferences): void {
    const userId = this.authStore.currentUser()?.id;

    if (!userId) return;

    firstValueFrom(this.client.updatePreferences(userId, data)).catch(() => {
      // Silently ignore save failures — preferences are non-critical.
    });
  }
}
