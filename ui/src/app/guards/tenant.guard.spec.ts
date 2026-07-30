import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRouteSnapshot, provideRouter, RouterStateSnapshot, UrlTree } from '@angular/router';
import { tenantGuard } from './tenant.guard';
import { TenantStore } from '@stores/tenant-store';
import { API_BASE_URL } from '@app/api-url.token';
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

  it('should redirect to / when tenantId is missing', async () => {
    setup();

    const result = await TestBed.runInInjectionContext(() => tenantGuard(makeRoute(null), mockState));

    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/');
  });

  it('should redirect to / when no active tenant and no match', async () => {
    setup();

    const result = TestBed.runInInjectionContext(() => tenantGuard(makeRoute('tenant-1'), mockState));
    // Guard calls loadTenants() when tenants list is empty — flush the HTTP request
    const http = TestBed.inject(HttpTestingController);
    const req = http.expectOne('http://localhost/api/tenants');

    req.flush({ data: [] });

    const resolved = await result;

    expect(resolved).toBeInstanceOf(UrlTree);
    expect((resolved as UrlTree).toString()).toBe('/');
  });

  it('should allow access when active tenant matches', async () => {
    setup();

    const tenantStore = TestBed.inject(TenantStore);

    tenantStore.tenants.set([{ id: 'tenant-1', name: 'Test', slug: 'test' }] as Tenant[]);
    tenantStore.setActiveTenant({ id: 'tenant-1', name: 'Test', slug: 'test' } as Tenant);

    const result = await TestBed.runInInjectionContext(() => tenantGuard(makeRoute('tenant-1'), mockState));

    expect(result).toBe(true);
  });
});
