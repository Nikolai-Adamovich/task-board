/**
 * Tests for the projectGuard.
 *
 * Covers:
 * - Returns true when tenantId and projectId are present and active tenant matches
 * - Redirects to / when tenantId or projectId is missing
 * - Redirects to / when active tenant does not match tenantId
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { projectGuard } from './project.guard';
import { TenantStore } from '@stores/tenant-store';
import { API_BASE_URL } from '@app/api-url.token';
import type { TenantWithRole } from '@task-board/shared';

const NOW = '2025-01-01T00:00:00Z';
const mockTenant: TenantWithRole = {
  id: 'tenant-1',
  name: 'Acme',
  slug: 'acme',
  description: null,
  subscription: 'free',
  role: 'owner',
  createdAt: NOW,
  updatedAt: NOW,
};

function createRoute(tenantId: string | null, projectId: string | null): ActivatedRouteSnapshot {
  return {
    paramMap: {
      get: (key: string) => {
        if (key === 'tenantId') return tenantId;
        if (key === 'projectId') return projectId;
        return null;
      },
    },
  } as unknown as ActivatedRouteSnapshot;
}

describe('projectGuard', () => {
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

  it('should return true when tenant and project IDs match the active tenant', () => {
    setup();

    const tenantStore = TestBed.inject(TenantStore);

    tenantStore.setActiveTenant(mockTenant);

    const result = TestBed.runInInjectionContext(() =>
      projectGuard(createRoute('tenant-1', 'proj-1'), {} as RouterStateSnapshot),
    );

    expect(result).toBe(true);
  });

  it('should redirect to / when tenantId is missing', () => {
    setup();

    const result = TestBed.runInInjectionContext(() =>
      projectGuard(createRoute(null, 'proj-1'), {} as RouterStateSnapshot),
    );

    expect(result).not.toBe(true);
  });

  it('should redirect to / when projectId is missing', () => {
    setup();

    const result = TestBed.runInInjectionContext(() =>
      projectGuard(createRoute('tenant-1', null), {} as RouterStateSnapshot),
    );

    expect(result).not.toBe(true);
  });

  it('should redirect to / when active tenant does not match tenantId', () => {
    setup();

    const tenantStore = TestBed.inject(TenantStore);

    tenantStore.setActiveTenant(mockTenant);

    const result = TestBed.runInInjectionContext(() =>
      projectGuard(createRoute('other-tenant', 'proj-1'), {} as RouterStateSnapshot),
    );

    expect(result).not.toBe(true);
  });

  it('should redirect to / when there is no active tenant', () => {
    setup();

    const result = TestBed.runInInjectionContext(() =>
      projectGuard(createRoute('tenant-1', 'proj-1'), {} as RouterStateSnapshot),
    );

    expect(result).not.toBe(true);
  });
});
