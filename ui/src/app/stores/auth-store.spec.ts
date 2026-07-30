import { TestBed } from '@angular/core/testing';
import { AuthStore } from './auth-store';
import type { User, AuthResponse } from '@task-board/shared';

describe('AuthStore', () => {
  function createModule() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [AuthStore],
    });
  }

  beforeEach(() => {
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
  });

  it('should restore token from localStorage', () => {
    localStorage.setItem('taskboard_token', 'test-token');
    createModule();

    const store = TestBed.inject(AuthStore);

    expect(store.token()).toBe('test-token');
    // Constructor no longer calls fetchCurrentUser (handled by authGuard)
    expect(store.currentUser()).toBeNull();
  });

  it('should decode tenantRole from JWT on setSession', () => {
    createModule();

    const store = TestBed.inject(AuthStore);
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

    store.setSession({
      token: fakeJwt,
      user: { id: '1', email: 'test@example.com', displayName: 'Test' } as User,
    } as AuthResponse);

    expect(store.tenantRole()).toBe('admin');
  });

  it('should expose null tenantRole when JWT has no tenantRole claim', () => {
    createModule();

    const store = TestBed.inject(AuthStore);
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const payload = btoa(JSON.stringify({ sub: '1', email: 'test@example.com', exp: 9999999999 }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const fakeJwt = `${header}.${payload}.fake-sig`;

    store.setSession({
      token: fakeJwt,
      user: { id: '1', email: 'test@example.com', displayName: 'Test' } as User,
    } as AuthResponse);

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

  it('should set user and token on setSession', () => {
    createModule();

    const store = TestBed.inject(AuthStore);

    store.setSession({
      token: 'jwt-token',
      user: { id: '1', email: 'test@example.com', displayName: 'Test' } as User,
    } as AuthResponse);

    expect(store.token()).toBe('jwt-token');
    expect(store.currentUser()?.email).toBe('test@example.com');
    expect(store.token()).toBe('jwt-token');
    expect(localStorage.getItem('taskboard_token')).toBe('jwt-token');
  });

  it('should clear state on logout', () => {
    createModule();

    const store = TestBed.inject(AuthStore);

    store.setSession({
      token: 'jwt-token',
      user: { id: '1', email: 'test@example.com', displayName: 'Test' } as User,
    } as AuthResponse);

    store.logout();

    expect(store.currentUser()).toBeNull();
    expect(store.token()).toBeNull();
    expect(localStorage.getItem('taskboard_token')).toBeNull();
  });
});
