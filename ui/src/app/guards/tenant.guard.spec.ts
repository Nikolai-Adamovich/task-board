import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRouteSnapshot, provideRouter, RouterStateSnapshot, UrlTree } from '@angular/router';
import { tenantGuard } from './tenant.guard';
import { TenantStore } from '@stores/tenant-store';
import { AuthStore } from '@stores/auth-store';
import { ProjectStore } from '@stores/project-store';
import { API_BASE_URL } from '@app/api-url.token';
import type { TenantWithRole } from '@app/types/frontend';

const NOW = '2025-01-01T00:00:00Z';
const mockTenants: TenantWithRole[] = [
  {
    id: 'tenant-1',
    name: 'Acme',
    slug: 'acme',
    description: null,
    status: 'ACTIVE',
    deletionScheduledAt: null,
    role: 'OWNER',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'tenant-2',
    name: 'Beta',
    slug: 'beta',
    description: null,
    status: 'ACTIVE',
    deletionScheduledAt: null,
    role: 'ADMIN',
    createdAt: NOW,
    updatedAt: NOW,
  },
];

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

  function makeRoute(tenantSlug: string | null): ActivatedRouteSnapshot {
    return { paramMap: { get: (key: string) => (key === 'tenantSlug' ? tenantSlug : null) } } as ActivatedRouteSnapshot;
  }

  it('should redirect to / when tenantSlug is missing', async () => {
    setup();

    const result = await TestBed.runInInjectionContext(() => tenantGuard(makeRoute(null), mockState));

    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/');
  });

  it('should redirect to / when no active tenant and no match', async () => {
    setup();

    const result = TestBed.runInInjectionContext(() => tenantGuard(makeRoute('acme'), mockState));
    // Guard calls loadTenants() when tenants list is empty — flush the HTTP request
    const http = TestBed.inject(HttpTestingController);
    const req = http.expectOne('http://localhost/api/tenants');

    req.flush({ data: [] });

    const resolved = await result;

    expect(resolved).toBeInstanceOf(UrlTree);
    expect((resolved as UrlTree).toString()).toBe('/');
  });

  it('should allow access when active tenant matches and sync tenantRole', async () => {
    setup();

    const tenantStore = TestBed.inject(TenantStore);
    const authStore = TestBed.inject(AuthStore);

    tenantStore.seedFromBootstrap(mockTenants);
    tenantStore.setActiveTenant(mockTenants[0] as TenantWithRole);

    const result = await TestBed.runInInjectionContext(() => tenantGuard(makeRoute('acme'), mockState));

    expect(result).toBe(true);
    expect(authStore.tenantRole()).toBe('OWNER');
  });

  it('should NOT call /tenants when bootstrap already initialized the store (even if empty)', async () => {
    setup();

    const tenantStore = TestBed.inject(TenantStore);
    const http = TestBed.inject(HttpTestingController);

    // Bootstrap already ran — the list is legitimately empty.
    tenantStore.seedFromBootstrap([]);

    const result = await TestBed.runInInjectionContext(() => tenantGuard(makeRoute('acme'), mockState));

    // No match in the (empty) list → redirect, but NO /tenants request.
    expect(result).toBeInstanceOf(UrlTree);
    http.verify();
  });

  it('should sync tenantRole when finding a matching tenant by route param', async () => {
    setup();

    const tenantStore = TestBed.inject(TenantStore);
    const authStore = TestBed.inject(AuthStore);

    tenantStore.seedFromBootstrap(mockTenants);
    // seedFromBootstrap defaults to the first tenant — the guard must still
    // resolve the route's tenant and sync its role.

    const result = await TestBed.runInInjectionContext(() => tenantGuard(makeRoute('beta'), mockState));

    expect(result).toBe(true);
    expect(authStore.tenantRole()).toBe('ADMIN');
    expect(tenantStore.activeTenant()?.id).toBe('tenant-2');
  });

  it('should clear the project context when switching tenants', async () => {
    setup();

    const tenantStore = TestBed.inject(TenantStore);
    const authStore = TestBed.inject(AuthStore);
    const projectStore = TestBed.inject(ProjectStore);

    tenantStore.seedFromBootstrap(mockTenants);
    tenantStore.setActiveTenant(mockTenants[0] as TenantWithRole);
    authStore.setTenantRole('OWNER');

    const result = await TestBed.runInInjectionContext(() => tenantGuard(makeRoute('beta'), mockState));

    expect(result).toBe(true);
    expect(projectStore.activeProject()).toBeNull();
  });
});
