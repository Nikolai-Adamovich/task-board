/**
 * Tests for the CreateWorkspace component.
 *
 * Covers:
 * - Signal form field validation (name, slug)
 * - Form-level validity
 * - onNameChange slug auto-generation
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { CreateWorkspace } from './create-workspace';
import { TenantStore } from '@stores/tenant-store';
import { AuthStore } from '@stores/auth-store';
import { API_BASE_URL } from '@app/api-url.token';
import type { TenantWithRole } from '@task-board/shared';

const NOW = '2025-01-01T00:00:00Z';
const mockTenant: TenantWithRole = {
  id: 't1',
  name: 'NewCo',
  slug: 'newco',
  description: null,
  subscription: 'free',
  role: 'owner',
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
      component.model.update((m: { name: string; slug: string }) => ({ ...m, name: 'My Workspace' }));
      expect(component.workspaceForm.name().valid()).toBe(true);
    });

    it('should be invalid when exceeding 100 characters', () => {
      component.model.update((m: { name: string; slug: string }) => ({ ...m, name: 'a'.repeat(101) }));
      expect(component.workspaceForm.name().invalid()).toBe(true);
    });

    it('should be valid at 100 characters', () => {
      component.model.update((m: { name: string; slug: string }) => ({ ...m, name: 'a'.repeat(100) }));
      expect(component.workspaceForm.name().valid()).toBe(true);
    });
  });

  // ── slug field validation ──────────────────────────────────────────────

  describe('slug field', () => {
    beforeEach(() => setup());

    it('should be invalid when empty', () => {
      expect(component.workspaceForm.slug().invalid()).toBe(true);
    });

    it('should be invalid when shorter than 2 characters', () => {
      component.model.update((m: { name: string; slug: string }) => ({ ...m, slug: 'a' }));
      expect(component.workspaceForm.slug().invalid()).toBe(true);
    });

    it('should be valid at 2 characters', () => {
      component.model.update((m: { name: string; slug: string }) => ({ ...m, slug: 'ab' }));
      expect(component.workspaceForm.slug().valid()).toBe(true);
    });

    it('should be invalid when exceeding 80 characters', () => {
      component.model.update((m: { name: string; slug: string }) => ({ ...m, slug: 'a'.repeat(81) }));
      expect(component.workspaceForm.slug().invalid()).toBe(true);
    });

    it('should be valid at 80 characters', () => {
      component.model.update((m: { name: string; slug: string }) => ({ ...m, slug: 'a'.repeat(80) }));
      expect(component.workspaceForm.slug().valid()).toBe(true);
    });
  });

  // ── Form-level validation ──────────────────────────────────────────────

  describe('form validity', () => {
    beforeEach(() => setup());

    it('should be invalid when all fields are empty', () => {
      expect(component.workspaceForm().invalid()).toBe(true);
    });

    it('should be valid when all fields are correctly filled', () => {
      component.model.update(() => ({ name: 'My Workspace', slug: 'my-workspace' }));
      expect(component.workspaceForm().valid()).toBe(true);
    });

    it('should be invalid when only name is filled', () => {
      component.model.update(() => ({ name: 'My Workspace', slug: '' }));
      expect(component.workspaceForm().invalid()).toBe(true);
    });

    it('should be invalid when only slug is filled', () => {
      component.model.update(() => ({ name: '', slug: 'my-workspace' }));
      expect(component.workspaceForm().invalid()).toBe(true);
    });
  });

  // ── onNameChange slug generation ───────────────────────────────────────

  describe('onNameChange', () => {
    beforeEach(() => setup());

    it('should auto-generate slug from name', () => {
      component.model.update((m: { name: string; slug: string }) => ({ ...m, name: 'My Cool Workspace' }));
      component.onNameChange();

      expect(component.model().slug).toBe('my-cool-workspace');
    });

    it('should handle special characters in name', () => {
      component.model.update((m: { name: string; slug: string }) => ({ ...m, name: 'Hello World! @#$' }));
      component.onNameChange();

      expect(component.model().slug).toBe('hello-world');
    });

    it('should trim leading and trailing hyphens', () => {
      component.model.update((m: { name: string; slug: string }) => ({ ...m, name: '---test---' }));
      component.onNameChange();

      expect(component.model().slug).toBe('test');
    });

    it('should collapse multiple spaces into single hyphen', () => {
      component.model.update((m: { name: string; slug: string }) => ({ ...m, name: 'a   b   c' }));
      component.onNameChange();

      expect(component.model().slug).toBe('a-b-c');
    });

    it('should lowercase the name', () => {
      component.model.update((m: { name: string; slug: string }) => ({ ...m, name: 'MY WORKSPACE' }));
      component.onNameChange();

      expect(component.model().slug).toBe('my-workspace');
    });
  });
});
