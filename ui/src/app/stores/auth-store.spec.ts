import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthStore } from './auth-store';
import { API_BASE_URL } from '@app/api-url.token';
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

  it('should decode tenantRole from JWT on login', () => {
    createModule();

    const store = TestBed.inject(AuthStore);

    store.login('test@example.com', 'password');

    const req = httpMock.expectOne('http://localhost/api/auth/login');
    // Build a JWT with tenantRole in the payload (header.payload.signature — signature not verified client-side)
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const payload = btoa(JSON.stringify({ sub: '1', email: 'test@example.com', tenantRole: 'admin', exp: 9999999999 }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const fakeJwt = `${header}.${payload}.fake-sig`;

    req.flush({
      token: fakeJwt,
      user: { id: '1', email: 'test@example.com', displayName: 'Test' } as User,
    });

    expect(store.tenantRole()).toBe('admin');
  });

  it('should expose null tenantRole when JWT has no tenantRole claim', () => {
    createModule();

    const store = TestBed.inject(AuthStore);

    store.login('test@example.com', 'password');

    const req = httpMock.expectOne('http://localhost/api/auth/login');
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const payload = btoa(JSON.stringify({ sub: '1', email: 'test@example.com', exp: 9999999999 }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const fakeJwt = `${header}.${payload}.fake-sig`;

    req.flush({
      token: fakeJwt,
      user: { id: '1', email: 'test@example.com', displayName: 'Test' } as User,
    });

    expect(store.tenantRole()).toBeNull();
  });

  it('should update tenantRole via setTenantRole', () => {
    createModule();

    const store = TestBed.inject(AuthStore);

    store.setTenantRole('owner');

    expect(store.tenantRole()).toBe('owner');

    store.setTenantRole('member');

    expect(store.tenantRole()).toBe('member');
  });

  it('should clear tenantRole on logout', () => {
    createModule();

    const store = TestBed.inject(AuthStore);

    store.setTenantRole('admin');
    store.logout();

    expect(store.tenantRole()).toBeNull();
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
