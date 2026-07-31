import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { PreferencesStore } from './preferences-store';
import { AuthStore } from './auth-store';
import { API_BASE_URL } from '@app/api-url.token';
import type { User, UserPreferences } from '@task-board/shared';

describe('PreferencesStore', () => {
  let httpMock: HttpTestingController;

  function createModule() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: 'http://localhost/api' },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
  }

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    document.documentElement.style.removeProperty('--zoom');
  });

  afterEach(() => {
    httpMock?.verify();
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    document.documentElement.style.removeProperty('--zoom');
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
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('should load preferences from backend', async () => {
    createModule();

    const authStore = TestBed.inject(AuthStore);

    seedAuthUser(authStore);

    const store = TestBed.inject(PreferencesStore);
    const promise = store.loadPreferences();
    const req = httpMock.expectOne('http://localhost/api/users/user-1/preferences');

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
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.style.getPropertyValue('--zoom')).toBe('1.25');
    expect(localStorage.getItem('taskboard_theme')).toBe('dark');
  });

  it('should set zoom and apply CSS variable', () => {
    createModule();

    const store = TestBed.inject(PreferencesStore);

    store.setZoom(150);

    expect(store.zoom()).toBe(150);
    expect(document.documentElement.style.getPropertyValue('--zoom')).toBe('1.5');
  });

  it('should set theme and toggle dark class', () => {
    createModule();

    const authStore = TestBed.inject(AuthStore);

    seedAuthUser(authStore);

    const store = TestBed.inject(PreferencesStore);

    store.setTheme('dark');

    expect(store.theme()).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('taskboard_theme')).toBe('dark');

    // Flush the PUT request triggered by setTheme
    const req = httpMock.expectOne('http://localhost/api/users/user-1/preferences');

    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ theme: 'dark' });
    req.flush({} as UserPreferences);

    store.setTheme('light');

    expect(store.theme()).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('taskboard_theme')).toBe('light');

    const req2 = httpMock.expectOne('http://localhost/api/users/user-1/preferences');

    expect(req2.request.method).toBe('PUT');
    expect(req2.request.body).toEqual({ theme: 'light' });
    req2.flush({} as UserPreferences);
  });

  it('should set language without backend call', () => {
    createModule();

    const store = TestBed.inject(PreferencesStore);

    store.setLanguage('de');

    expect(store.language()).toBe('de');
  });
});
