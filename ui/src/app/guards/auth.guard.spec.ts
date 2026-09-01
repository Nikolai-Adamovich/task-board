import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRouteSnapshot, provideRouter, RouterStateSnapshot, UrlTree } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthStore } from '@stores/auth-store';
import { TenantStore } from '@stores/tenant-store';
import { API_BASE_URL } from '@app/api-url.token';
import type { User } from '@task-board/shared';

describe('authGuard', () => {
  const mockRoute = {} as ActivatedRouteSnapshot;
  const mockState = {} as RouterStateSnapshot;

  beforeEach(() => {
    localStorage.clear();
  });

  function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'auth/login', redirectTo: '/' }]),
        { provide: API_BASE_URL, useValue: 'http://localhost/api' },
      ],
    });
  }

  it('should redirect to /auth/login when not authenticated', async () => {
    setup();

    const result = await TestBed.runInInjectionContext(() => authGuard(mockRoute, mockState));

    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/auth/login');
  });

  it('should allow access when token is valid (bootstrap: user + tenants in one request)', async () => {
    setup();

    const store = TestBed.inject(AuthStore);
    const tenantStore = TestBed.inject(TenantStore);
    const httpMock = TestBed.inject(HttpTestingController);

    store.token.set('valid-jwt-token');

    const guardPromise = TestBed.runInInjectionContext(() => authGuard(mockRoute, mockState));
    // Guard calls bootstrap since token exists but the session is not initialized
    const req = httpMock.expectOne('http://localhost/api/auth/bootstrap');

    req.flush({
      data: {
        user: { id: '1', email: 'test@test.com', displayName: 'Test' } as User,
        tenants: [{ id: 't1', name: 'Acme', slug: 'acme', role: 'OWNER' }],
      },
    });

    const result = await guardPromise;

    expect(result).toBe(true);
    // Bootstrap seeded both stores — no follow-up /tenants request
    expect(store.currentUser()?.id).toBe('1');
    expect(tenantStore.tenantsLoaded()).toBe(true);
    expect(tenantStore.tenants().length).toBe(1);
    httpMock.verify();
  });

  it('should redirect to login when bootstrap returns 401', async () => {
    setup();

    const store = TestBed.inject(AuthStore);
    const httpMock = TestBed.inject(HttpTestingController);

    store.token.set('expired-token');

    const guardPromise = TestBed.runInInjectionContext(() => authGuard(mockRoute, mockState));
    const req = httpMock.expectOne('http://localhost/api/auth/bootstrap');

    req.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    const result = await guardPromise;

    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/auth/login');
  });
});
