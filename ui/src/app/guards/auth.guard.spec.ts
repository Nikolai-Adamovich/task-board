import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRouteSnapshot, provideRouter, RouterStateSnapshot, UrlTree } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthStore } from '@stores/auth-store';
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

  it('should allow access when token is valid', async () => {
    setup();

    const store = TestBed.inject(AuthStore);
    const httpMock = TestBed.inject(HttpTestingController);

    store.token.set('valid-jwt-token');

    const guardPromise = TestBed.runInInjectionContext(() => authGuard(mockRoute, mockState));
    // Guard calls fetchCurrentUser since token exists but no currentUser
    const req = httpMock.expectOne('http://localhost/api/auth/me');

    req.flush({ id: '1', email: 'test@test.com', displayName: 'Test' } as User);

    const result = await guardPromise;

    expect(result).toBe(true);
  });

  it('should redirect to login when fetchCurrentUser returns 401', async () => {
    setup();

    const store = TestBed.inject(AuthStore);
    const httpMock = TestBed.inject(HttpTestingController);

    store.token.set('expired-token');

    const guardPromise = TestBed.runInInjectionContext(() => authGuard(mockRoute, mockState));
    const req = httpMock.expectOne('http://localhost/api/auth/me');

    req.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    const result = await guardPromise;

    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/auth/login');
  });
});
