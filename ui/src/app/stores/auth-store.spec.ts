import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthStore } from './auth-store';
import { API_BASE_URL } from '../api-url.token';
import type { User } from '@task-board/shared';

describe('AuthStore', () => {
  let httpMock: HttpTestingController;

  function createModule() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        AuthStore,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://localhost/api' },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
  }

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    httpMock?.verify();
    localStorage.clear();
  });

  it('should be created', () => {
    createModule();

    const store = TestBed.inject(AuthStore);

    expect(store).toBeTruthy();
  });

  it('should have no user initially', () => {
    createModule();

    const store = TestBed.inject(AuthStore);

    expect(store.currentUser()).toBeNull();
    expect(store.isAuthenticated()).toBe(false);
  });

  it('should restore token from localStorage', () => {
    localStorage.setItem('taskboard_token', 'test-token');
    createModule();

    const store = TestBed.inject(AuthStore);

    expect(store.token()).toBe('test-token');

    // Constructor also calls fetchCurrentUser when token exists
    const req = httpMock.expectOne('http://localhost/api/auth/me');

    req.flush({ id: '1', email: 'user@test.com', displayName: 'User' } as User);
  });

  it('should set user and token on login', () => {
    createModule();

    const store = TestBed.inject(AuthStore);

    store.login('test@example.com', 'password');

    const req = httpMock.expectOne('http://localhost/api/auth/login');

    req.flush({
      token: 'jwt-token',
      user: { id: '1', email: 'test@example.com', displayName: 'Test' } as User,
    });

    expect(store.token()).toBe('jwt-token');
    expect(store.currentUser()?.email).toBe('test@example.com');
    expect(store.isAuthenticated()).toBe(true);
    expect(localStorage.getItem('taskboard_token')).toBe('jwt-token');
  });

  it('should clear state on logout', () => {
    createModule();

    const store = TestBed.inject(AuthStore);

    store.login('test@example.com', 'password');

    const req = httpMock.expectOne('http://localhost/api/auth/login');

    req.flush({
      token: 'jwt-token',
      user: { id: '1', email: 'test@example.com', displayName: 'Test' } as User,
    });

    store.logout();

    expect(store.currentUser()).toBeNull();
    expect(store.token()).toBeNull();
    expect(store.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('taskboard_token')).toBeNull();
  });

  it('should fetch current user on init when token exists', () => {
    localStorage.setItem('taskboard_token', 'existing-token');
    createModule();

    // Constructor automatically fetches current user when token exists
    const store = TestBed.inject(AuthStore);
    const req = httpMock.expectOne('http://localhost/api/auth/me');

    req.flush({ id: '1', email: 'user@test.com', displayName: 'User' } as User);

    expect(store.currentUser()?.email).toBe('user@test.com');
  });
});
