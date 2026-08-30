import { firstValueFrom } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { importProvidersFrom } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TranslocoService, TranslocoTestingModule } from '@jsverse/transloco';
import { PreferencesStore } from './preferences-store';
import { AuthStore } from './auth-store';
import { ThemeLoader } from '@services/theme-loader';
import { ThemeRegistry } from '@services/theme-registry';
import { API_BASE_URL } from '@app/api-url.token';
import type { ThemeManifestItem, User, UserPreferences } from '@task-board/shared';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('PreferencesStore (theme mode model)', () => {
  let httpMock: HttpTestingController;
  let themeLoader: { loadTheme: ReturnType<typeof vi.fn> };
  const manifestItem = (id: string, mode: 'light' | 'dark'): ThemeManifestItem => ({
    id,
    name: id,
    mode,
    css: `${id}.css`,
    preview: { primary: '#000', muted: '#111', foreground: '#222', card: '#333', border: '#444' },
  });

  async function createModule() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: 'http://localhost/api' },
        importProvidersFrom(
          TranslocoTestingModule.forRoot({
            preloadLangs: true,
            langs: { en: {}, pl: {}, de: {} },
            translocoConfig: { availableLangs: ['en', 'pl', 'de'], defaultLang: 'en' },
          }),
        ),
        { provide: ThemeLoader, useValue: { loadTheme: vi.fn() } },
        {
          provide: ThemeRegistry,
          useValue: {
            load: vi.fn(async () => undefined),
            findById: vi.fn((id: string) => (id === 'nord' ? manifestItem('nord', 'dark') : undefined)),
          },
        },
      ],
    });
    await firstValueFrom(TestBed.inject(TranslocoService).load('en'));

    httpMock = TestBed.inject(HttpTestingController);
    themeLoader = TestBed.inject(ThemeLoader) as unknown as { loadTheme: ReturnType<typeof vi.fn> };
  }

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.style.removeProperty('font-size');
  });

  afterEach(() => {
    httpMock?.verify();
    localStorage.clear();
    document.documentElement.style.removeProperty('font-size');
  });

  function seedAuthUser(store: AuthStore): void {
    store.setSession({
      token: 'fake-jwt',
      user: { id: 'user-1', email: 'test@example.com', displayName: 'Test' } as User,
    });
  }

  it('should default to Auto mode with browser-driven resolution', async () => {
    await createModule();

    const store = TestBed.inject(PreferencesStore);

    expect(store.themeMode()).toBe('auto');
    expect(store.lightTheme()).toBeNull();
    expect(store.darkTheme()).toBeNull();
    // jsdom has no matchMedia → system scheme treated as light → default light theme.
    expect(store.effectiveTheme()).toBe('light');
    expect(themeLoader.loadTheme).toHaveBeenCalledWith('light');
  });

  it('should restore mode-aware theme preferences from localStorage', async () => {
    localStorage.setItem(
      'taskboard_theme_v2',
      JSON.stringify({ themeMode: 'dark', lightTheme: null, darkTheme: 'nord' }),
    );
    await createModule();

    const store = TestBed.inject(PreferencesStore);

    expect(store.themeMode()).toBe('dark');
    expect(store.darkTheme()).toBe('nord');
    expect(store.effectiveTheme()).toBe('nord');
    expect(themeLoader.loadTheme).toHaveBeenCalledWith('nord');
  });

  it('should apply the resolved theme at bootstrap even with nothing persisted (P8-13)', async () => {
    await createModule();

    const store = TestBed.inject(PreferencesStore);

    expect(store.effectiveTheme()).toBe('light');
    expect(themeLoader.loadTheme).toHaveBeenCalledWith('light');
  });

  it('should resolve auto mode from the system color-scheme signal', async () => {
    await createModule();

    const store = TestBed.inject(PreferencesStore);

    store.systemPrefersDark.set(true);
    expect(store.effectiveTheme()).toBe('dark');

    store.systemPrefersDark.set(false);
    expect(store.effectiveTheme()).toBe('light');
  });

  it('should resolve explicit light/dark modes from the per-mode choices', async () => {
    localStorage.setItem(
      'taskboard_theme_v2',
      JSON.stringify({ themeMode: 'light', lightTheme: 'github-light', darkTheme: 'nord' }),
    );
    await createModule();

    const store = TestBed.inject(PreferencesStore);

    expect(store.effectiveTheme()).toBe('github-light');

    store.setThemeModeLocal('dark');
    expect(store.effectiveTheme()).toBe('nord');
  });

  it('should migrate a legacy localStorage theme id to the mode model', async () => {
    localStorage.setItem('taskboard_theme', 'nord');
    await createModule();

    const store = TestBed.inject(PreferencesStore);

    // Legacy theme is applied immediately (pre-auth appearance unchanged)…
    expect(themeLoader.loadTheme).toHaveBeenCalledWith('nord');

    // …then migrated once the manifest resolves the theme's mode.
    await vi.waitFor(() => expect(store.themeMode()).toBe('dark'));

    expect(store.themeMode()).toBe('dark');
    expect(store.darkTheme()).toBe('nord');
    expect(store.lightTheme()).toBeNull();
    expect(store.effectiveTheme()).toBe('nord');
    expect(JSON.parse(localStorage.getItem('taskboard_theme_v2') ?? '{}')).toEqual({
      themeMode: 'dark',
      lightTheme: null,
      darkTheme: 'nord',
    });
  });

  it('should load mode-aware preferences from the backend', async () => {
    await createModule();

    const authStore = TestBed.inject(AuthStore);

    seedAuthUser(authStore);

    const store = TestBed.inject(PreferencesStore);
    const promise = store.loadPreferences();
    const req = httpMock.expectOne('http://localhost/api/preferences');

    expect(req.request.method).toBe('GET');

    const mockPrefs: UserPreferences = {
      userId: 'user-1',
      zoom: 125,
      theme: 'dark',
      themeMode: 'dark',
      lightTheme: null,
      darkTheme: 'nord',
      language: 'pl',
      pageSize: 20,
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '12h',
      updatedAt: new Date().toISOString(),
    };

    req.flush({ data: mockPrefs });
    await promise;

    expect(store.zoom()).toBe(125);
    expect(store.themeMode()).toBe('dark');
    expect(store.darkTheme()).toBe('nord');
    expect(store.effectiveTheme()).toBe('nord');
    expect(store.language()).toBe('pl');
    expect(store.datePipeFormat()).toBe('dd/MM/yyyy');
    expect(store.dateTimePipeFormat()).toBe('dd/MM/yyyy h:mm a');
    expect(themeLoader.loadTheme).toHaveBeenCalledWith('nord');
    expect(document.documentElement.style.getPropertyValue('font-size')).toBe('125%');
    expect(JSON.parse(localStorage.getItem('taskboard_theme_v2') ?? '{}')).toEqual({
      themeMode: 'dark',
      lightTheme: null,
      darkTheme: 'nord',
    });
  });

  it('should migrate a legacy backend payload (theme only) to the mode model', async () => {
    await createModule();

    const authStore = TestBed.inject(AuthStore);

    seedAuthUser(authStore);

    const store = TestBed.inject(PreferencesStore);
    const promise = store.loadPreferences();
    const req = httpMock.expectOne('http://localhost/api/preferences');

    // Legacy server payload: only the single `theme` field, no mode fields yet.
    req.flush({
      data: {
        userId: 'user-1',
        zoom: 100,
        theme: 'nord',
        language: 'en',
        pageSize: 20,
        dateFormat: null,
        timeFormat: null,
        updatedAt: new Date().toISOString(),
      },
    });
    await promise;

    await vi.waitFor(() => expect(store.themeMode()).toBe('dark'));

    expect(store.darkTheme()).toBe('nord');

    // The authenticated migration persists the migrated mode model to the backend.
    const put = httpMock.expectOne('http://localhost/api/preferences');

    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ themeMode: 'dark', lightTheme: null, darkTheme: 'nord' });
    put.flush({} as UserPreferences);
  });

  it('should set zoom locally without backend call, then persist on commit', async () => {
    await createModule();

    const authStore = TestBed.inject(AuthStore);

    seedAuthUser(authStore);

    const store = TestBed.inject(PreferencesStore);

    store.setZoomLocal(150);

    expect(store.zoom()).toBe(150);
    expect(document.documentElement.style.getPropertyValue('font-size')).toBe('150%');

    httpMock.expectNone('http://localhost/api/preferences');

    store.commitZoom();

    const req = httpMock.expectOne('http://localhost/api/preferences');

    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ zoom: 150 });
    req.flush({} as UserPreferences);
  });

  it('should set the theme mode locally without backend call, then persist on commit', async () => {
    await createModule();

    const authStore = TestBed.inject(AuthStore);

    seedAuthUser(authStore);

    const store = TestBed.inject(PreferencesStore);

    store.setThemeModeLocal('dark');

    expect(store.themeMode()).toBe('dark');
    expect(JSON.parse(localStorage.getItem('taskboard_theme_v2') ?? '{}').themeMode).toBe('dark');

    // No HTTP request yet — setThemeModeLocal only applies locally
    httpMock.expectNone('http://localhost/api/preferences');

    store.commitTheme();

    const req = httpMock.expectOne('http://localhost/api/preferences');

    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ themeMode: 'dark' });
    req.flush({} as UserPreferences);
  });

  it('should store a theme choice per mode and persist it on commit', async () => {
    await createModule();

    const authStore = TestBed.inject(AuthStore);

    seedAuthUser(authStore);

    const store = TestBed.inject(PreferencesStore);

    store.setThemeChoiceLocal('nord', 'dark');

    expect(store.darkTheme()).toBe('nord');
    expect(store.lightTheme()).toBeNull();
    expect(JSON.parse(localStorage.getItem('taskboard_theme_v2') ?? '{}').darkTheme).toBe('nord');

    httpMock.expectNone('http://localhost/api/preferences');

    store.commitTheme();

    const req = httpMock.expectOne('http://localhost/api/preferences');

    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ darkTheme: 'nord' });
    req.flush({} as UserPreferences);

    // A light choice lands in lightTheme and both pendings flush together.
    store.setThemeChoiceLocal('github-light', 'light');
    store.commitTheme();

    const req2 = httpMock.expectOne('http://localhost/api/preferences');

    expect(req2.request.body).toEqual({ lightTheme: 'github-light' });
    req2.flush({} as UserPreferences);
  });

  it('should keep the applied theme browser-driven in auto mode while storing a per-mode choice', async () => {
    await createModule();

    const store = TestBed.inject(PreferencesStore);

    // Auto + light system scheme → light applied.
    expect(store.effectiveTheme()).toBe('light');

    // Picking a dark theme in auto mode stores darkTheme but keeps the light theme applied.
    store.setThemeChoiceLocal('nord', 'dark');

    expect(store.darkTheme()).toBe('nord');
    expect(store.effectiveTheme()).toBe('light');
    expect(store.selectedTheme()).toBe('light');

    // Flipping the system scheme to dark applies the stored dark theme.
    store.systemPrefersDark.set(true);
    expect(store.effectiveTheme()).toBe('nord');
  });

  it('should set language and persist to backend', async () => {
    await createModule();

    const authStore = TestBed.inject(AuthStore);

    seedAuthUser(authStore);

    const store = TestBed.inject(PreferencesStore);

    store.setLanguage('de');

    expect(store.language()).toBe('de');

    const req = httpMock.expectOne('http://localhost/api/preferences');

    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ language: 'de' });
    req.flush({} as UserPreferences);
  });
});
