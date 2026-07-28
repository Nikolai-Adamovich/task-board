import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRouteSnapshot, provideRouter, RouterStateSnapshot, UrlTree } from '@angular/router';
import { tenantGuard } from './tenant.guard';
import { TenantClient } from '../services/tenant-client';
import { API_BASE_URL } from '../api-url.token';
import type { Tenant } from '@task-board/shared';

describe('tenantGuard', () => {
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

  function makeRoute(tenantId: string | null): ActivatedRouteSnapshot {
    return { paramMap: { get: (key: string) => (key === 'tenantId' ? tenantId : null) } } as ActivatedRouteSnapshot;
  }

  it('should redirect to / when tenantId is missing', () => {
    setup();

    const result = TestBed.runInInjectionContext(() => tenantGuard(makeRoute(null), mockState));

    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/');
  });

  it('should redirect to / when no active tenant and no match', () => {
    setup();

    const result = TestBed.runInInjectionContext(() => tenantGuard(makeRoute('tenant-1'), mockState));

    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/');
  });

  it('should allow access when active tenant matches', () => {
    setup();

    const tenantService = TestBed.inject(TenantClient);

    tenantService.tenants.set([{ id: 'tenant-1', name: 'Test', slug: 'test' }] as Tenant[]);
    tenantService.setActiveTenant({ id: 'tenant-1', name: 'Test', slug: 'test' } as Tenant);

    const result = TestBed.runInInjectionContext(() => tenantGuard(makeRoute('tenant-1'), mockState));

    expect(result).toBe(true);
  });
});
