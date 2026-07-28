import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
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
        provideRouter([]),
        { provide: API_BASE_URL, useValue: 'http://localhost/api' },
      ],
    });
  }

  it('should redirect to /auth/login when not authenticated', () => {
    setup();

    const result = TestBed.runInInjectionContext(() => authGuard(mockRoute, mockState));

    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/auth/login');
  });

  it('should allow access when authenticated', () => {
    setup();

    const store = TestBed.inject(AuthStore);

    store.currentUser.set({
      id: '1',
      email: 'test@test.com',
      displayName: 'Test',
    } as User);

    const result = TestBed.runInInjectionContext(() => authGuard(mockRoute, mockState));

    expect(result).toBe(true);
  });
});
