import { TestBed } from '@angular/core/testing';
import { importProvidersFrom } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { PreferencesStore } from './preferences-store';
import { AuthStore } from './auth-store';
import { ThemeLoader } from '@services/theme-loader';
import { API_BASE_URL } from '@app/api-url.token';
import type { User, UserPreferences } from '@task-board/shared';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('PreferencesStore', () => {
  let httpMock: HttpTestingController;
  let themeLoader: unknown;

  function createModule() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: 'http://localhost/api' },
        importProvidersFrom(
          TranslocoTestingModule.forRoot({
            langs: { en: {}, pl: {}, de: {} },
            translocoConfig: { availableLangs: ['en', 'pl', 'de'], defaultLang: 'en' },
          }),
        ),
        {
          provide: ThemeLoader,
          useValue: { loadTheme: vi.fn() },
        },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    themeLoader = TestBed.inject(ThemeLoader);
  }

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    document.documentElement.style.removeProperty('font-size');
  });

  afterEach(() => {
    httpMock?.verify();
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    document.documentElement.style.removeProperty('font-size');
  });

  function seedAuthUser(store: AuthStore): void {
    store.setSession({
      token: 'fake-jwt',
      user: { id: 'user-1', email: 'test@example.com', displayName: 'Test' } as User,
    });
  }

  it('should be created', () => {
    createModule();

    const store = TestBed.inject(PreferencesStore);

    expect(store).toBeTruthy();
  });

  it('should have default values', () => {
    createModule();

    const store = TestBed.inject(PreferencesStore);

    expect(store.zoom()).toBe(100);
    expect(store.theme()).toBe('light');
    expect(store.language()).toBe('en');
  });

  it('should restore dark theme from localStorage', () => {
    localStorage.setItem('taskboard_theme', 'dark');
    createModule();

    const store = TestBed.inject(PreferencesStore);

    expect(store.theme()).toBe('dark');
    expect((themeLoader as { loadTheme: ReturnType<typeof vi.fn> }).loadTheme).toHaveBeenCalledWith('dark');
  });

  it('should load preferences from backend', async () => {
    createModule();

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
      language: 'pl',
      updatedAt: new Date().toISOString(),
    };

    req.flush(mockPrefs);
    await promise;

    expect(store.zoom()).toBe(125);
    expect(store.theme()).toBe('dark');
    expect(store.language()).toBe('pl');
    expect((themeLoader as { loadTheme: ReturnType<typeof vi.fn> }).loadTheme).toHaveBeenCalledWith('dark');
    expect(document.documentElement.style.getPropertyValue('font-size')).toBe('125%');
    expect(localStorage.getItem('taskboard_theme')).toBe('dark');
  });

  it('should set zoom locally without backend call, then persist on commit', () => {
    createModule();

    const authStore = TestBed.inject(AuthStore);

    seedAuthUser(authStore);

    const store = TestBed.inject(PreferencesStore);

    store.setZoomLocal(150);

    expect(store.zoom()).toBe(150);
    expect(document.documentElement.style.getPropertyValue('font-size')).toBe('150%');

    // No HTTP request yet — setZoomLocal only applies zoom locally
    httpMock.expectNone('http://localhost/api/preferences');

    // Committing flushes the pending zoom to the backend
    store.commitZoom();

    const req = httpMock.expectOne('http://localhost/api/preferences');

    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ zoom: 150 });
    req.flush({} as UserPreferences);
  });

  it('should set theme locally without backend call, then persist on commit', () => {
    createModule();

    const authStore = TestBed.inject(AuthStore);

    seedAuthUser(authStore);

    const store = TestBed.inject(PreferencesStore);

    store.setThemeLocal('dark');

    expect(store.theme()).toBe('dark');
    expect((themeLoader as { loadTheme: ReturnType<typeof vi.fn> }).loadTheme).toHaveBeenCalledWith('dark');
    expect(localStorage.getItem('taskboard_theme')).toBe('dark');

    // No HTTP request yet — setThemeLocal only applies the theme locally
    httpMock.expectNone('http://localhost/api/preferences');

    // Committing flushes the pending theme to the backend
    store.commitTheme();

    const req = httpMock.expectOne('http://localhost/api/preferences');

    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ theme: 'dark' });
    req.flush({} as UserPreferences);

    store.setThemeLocal('light');

    expect(store.theme()).toBe('light');
    expect((themeLoader as { loadTheme: ReturnType<typeof vi.fn> }).loadTheme).toHaveBeenCalledWith('light');
    expect(localStorage.getItem('taskboard_theme')).toBe('light');

    store.commitTheme();

    const req2 = httpMock.expectOne('http://localhost/api/preferences');

    expect(req2.request.method).toBe('PUT');
    expect(req2.request.body).toEqual({ theme: 'light' });
    req2.flush({} as UserPreferences);
  });

  it('should set language and persist to backend', () => {
    createModule();

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
