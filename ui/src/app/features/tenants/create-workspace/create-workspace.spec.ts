/**
 * Tests for the CreateWorkspace component.
 *
 * Covers:
 * - Signal form field validation (name)
 * - Form-level validity
 * - Description field
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { CreateWorkspace } from './create-workspace';
import { TenantStore } from '@stores/tenant-store';
import { AuthStore } from '@stores/auth-store';
import { API_BASE_URL } from '@app/api-url.token';
import type { TenantWithRole } from '@app/types/frontend';

const NOW = '2025-01-01T00:00:00Z';
const mockTenant: TenantWithRole = {
  id: 't1',
  name: 'NewCo',
  description: null,
  status: 'ACTIVE',
  deletionScheduledAt: null,
  role: 'OWNER',
  createdAt: NOW,
  updatedAt: NOW,
};

describe('CreateWorkspace', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let component: any;
  let tenantStoreMock: {
    createTenant: ReturnType<typeof vi.fn>;
  };
  let authStoreMock: {
    setTenantContext: ReturnType<typeof vi.fn>;
  };
  let routerMock: { navigateByUrl: ReturnType<typeof vi.fn> };

  function setup() {
    tenantStoreMock = {
      createTenant: vi.fn().mockResolvedValue(mockTenant),
    };
    authStoreMock = {
      setTenantContext: vi.fn(),
    };
    routerMock = {
      navigateByUrl: vi.fn().mockResolvedValue(true),
    };

    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { en: {} } })],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: 'http://localhost/api' },
        { provide: TenantStore, useValue: tenantStoreMock },
        { provide: AuthStore, useValue: authStoreMock },
        { provide: Router, useValue: routerMock },
      ],
    });

    const fixture = TestBed.createComponent(CreateWorkspace);

    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  // ── name field validation ──────────────────────────────────────────────

  describe('name field', () => {
    beforeEach(() => setup());

    it('should be invalid when empty', () => {
      expect(component.workspaceForm.name().invalid()).toBe(true);
    });

    it('should be valid for non-empty value', () => {
      component.model.update((m: { name: string; description: string }) => ({ ...m, name: 'NewCo' }));
      expect(component.workspaceForm.name().valid()).toBe(true);
    });

    it('should be invalid when exceeding 100 characters', () => {
      component.model.update((m: { name: string; description: string }) => ({ ...m, name: 'a'.repeat(101) }));
      expect(component.workspaceForm.name().invalid()).toBe(true);
    });

    it('should be valid at 100 characters', () => {
      component.model.update((m: { name: string; description: string }) => ({ ...m, name: 'a'.repeat(100) }));
      expect(component.workspaceForm.name().valid()).toBe(true);
    });
  });

  // ── Form-level validation ──────────────────────────────────────────────

  describe('form validity', () => {
    beforeEach(() => setup());

    it('should be invalid when name is empty', () => {
      expect(component.workspaceForm().invalid()).toBe(true);
    });

    it('should be valid when name is filled', () => {
      component.model.update(() => ({ name: 'NewCo', description: '' }));
      expect(component.workspaceForm().valid()).toBe(true);
    });
  });
});
