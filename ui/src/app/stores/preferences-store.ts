import { Service, signal, inject, effect } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { DEFAULT_THEME_ID } from '@task-board/shared';
import { UserPreferencesClient } from '@services/user-preferences-client';
import { AuthStore } from '@stores/auth-store';
import { ThemeLoader } from '@services/theme-loader';
import type { UserPreferences, UpdateUserPreferences } from '@task-board/shared';

const THEME_KEY = 'taskboard_theme';

/**
 * Signal-based preferences store.
 * Manages per-user UI settings: zoom, theme, and language.
 * Uses UserPreferencesClient for all HTTP calls — the store only handles orchestration and state.
 */
@Service()
export class PreferencesStore {
  private readonly client = inject(UserPreferencesClient);
  private readonly authStore = inject(AuthStore);
  private readonly transloco = inject(TranslocoService);
  private readonly themeLoader = inject(ThemeLoader);
  readonly zoom = signal<number>(100);
  readonly theme = signal<string>(DEFAULT_THEME_ID);
  readonly language = signal<string>('en');
  /** Tracks the last zoom applied locally but not yet persisted to the backend. */
  private pendingZoom: number | null = null;
  /** Tracks the last theme applied locally but not yet persisted to the backend. */
  private pendingTheme: string | null = null;

  constructor() {
    this.restoreThemeFromLocalStorage();

    // Load preferences from backend once the user is authenticated.
    effect(() => {
      if (this.authStore.isAuthenticated()) {
        this.loadPreferences();
      }
    });
  }

  /** Restore theme preference from localStorage and apply the theme CSS. */
  restoreThemeFromLocalStorage(): void {
    const stored = localStorage.getItem(THEME_KEY);

    if (stored) {
      this.theme.set(stored);
      this.themeLoader.loadTheme(stored);
    }
  }

  /** Load preferences from the backend and apply all settings. */
  async loadPreferences(): Promise<void> {
    const userId = this.authStore.currentUser()?.id;

    if (!userId) return;

    const prefs = await firstValueFrom(this.client.getPreferences(userId));

    this.applyPreferences(prefs);
  }

  /** Set zoom level and apply CSS — without saving to backend. */
  setZoomLocal(value: number): void {
    this.zoom.set(value);
    document.documentElement.style.setProperty('font-size', `${value}%`);
    this.pendingZoom = value;
  }

  /** Persist the pending zoom change to the backend. No-op if nothing is pending. */
  commitZoom(): void {
    if (this.pendingZoom !== null) {
      this.saveToBackend({ zoom: this.pendingZoom });
      this.pendingZoom = null;
    }
  }

  /** Set theme, load the corresponding CSS file, and sync localStorage — without saving to backend. */
  setThemeLocal(themeId: string): void {
    this.theme.set(themeId);
    this.themeLoader.loadTheme(themeId);
    localStorage.setItem(THEME_KEY, themeId);
    this.pendingTheme = themeId;
  }

  /** Persist the pending theme change to the backend. No-op if nothing is pending. */
  commitTheme(): void {
    if (this.pendingTheme !== null) {
      this.saveToBackend({ theme: this.pendingTheme });
      this.pendingTheme = null;
    }
  }

  /** Set language, switch Transloco active lang, and persist to backend. */
  setLanguage(language: string): void {
    this.language.set(language);
    this.transloco.setActiveLang(language);
    this.saveToBackend({ language });
  }

  /** Apply all preference values from a backend response. */
  private applyPreferences(prefs: UserPreferences): void {
    this.zoom.set(prefs.zoom);
    this.theme.set(prefs.theme);
    this.language.set(prefs.language);
    this.transloco.setActiveLang(prefs.language);

    document.documentElement.style.setProperty('font-size', `${prefs.zoom}%`);

    this.themeLoader.loadTheme(prefs.theme);

    localStorage.setItem(THEME_KEY, prefs.theme);
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
