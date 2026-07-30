/**
 * Tests for the TenantSettings component.
 *
 * Covers:
 * - Initialization from active tenant
 * - save method
 * - deleteTenant method
 * - canEdit computed
 * - onDialogStateChange
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { TenantSettings } from './tenant-settings';
import { TenantStore } from '@stores/tenant-store';
import { AuthStore } from '@stores/auth-store';
import { API_BASE_URL } from '@app/api-url.token';
import type { TenantWithRole } from '@task-board/shared';

const NOW = '2025-01-01T00:00:00Z';
const mockTenant: TenantWithRole = {
  id: 't1',
  name: 'Acme',
  slug: 'acme',
  description: null,
  subscription: 'free',
  role: 'owner',
  createdAt: NOW,
  updatedAt: NOW,
};

describe('TenantSettings', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let component: any;
  let tenantStoreMock: {
    activeTenant: ReturnType<typeof vi.fn>;
    updateTenant: ReturnType<typeof vi.fn>;
    deleteTenant: ReturnType<typeof vi.fn>;
  };
  let authStoreMock: { tenantRole: ReturnType<typeof vi.fn> };
  let routerMock: { navigate: ReturnType<typeof vi.fn> };

  function setup(role = 'owner') {
    tenantStoreMock = {
      activeTenant: vi.fn().mockReturnValue(mockTenant),
      updateTenant: vi.fn().mockResolvedValue({ ...mockTenant, name: 'Updated' }),
      deleteTenant: vi.fn().mockResolvedValue(undefined),
    };
    authStoreMock = {
      tenantRole: vi.fn().mockReturnValue(role),
    };
    routerMock = { navigate: vi.fn().mockResolvedValue(true) };

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

    const fixture = TestBed.createComponent(TenantSettings);

    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  // ── Initialization ─────────────────────────────────────────────────────

  describe('ngOnInit', () => {
    beforeEach(() => setup());

    it('should populate name and slug from active tenant', () => {
      expect(component.name).toBe('Acme');
      expect(component.slug).toBe('acme');
    });

    it('should set loading to false', () => {
      expect(component.loading()).toBe(false);
    });
  });

  // ── canEdit ────────────────────────────────────────────────────────────

  describe('canEdit', () => {
    it('should be true for owner', () => {
      setup('owner');
      expect(component.canEdit()).toBe(true);
    });

    it('should be true for admin', () => {
      setup('admin');
      expect(component.canEdit()).toBe(true);
    });

    it('should be false for member', () => {
      setup('member');
      expect(component.canEdit()).toBe(false);
    });
  });

  // ── save ───────────────────────────────────────────────────────────────

  describe('save', () => {
    beforeEach(() => setup());

    it('should call tenantStore.updateTenant', () => {
      component.name = 'New Name';
      component.slug = 'new-slug';
      component.save();

      expect(tenantStoreMock.updateTenant).toHaveBeenCalledWith('t1', { name: 'New Name', slug: 'new-slug' });
    });

    it('should not save when name is empty', () => {
      component.name = '';
      component.save();

      expect(tenantStoreMock.updateTenant).not.toHaveBeenCalled();
    });

    it('should not save when slug is empty', () => {
      component.slug = '';
      component.save();

      expect(tenantStoreMock.updateTenant).not.toHaveBeenCalled();
    });

    it('should set success message on success', async () => {
      component.name = 'New Name';
      component.slug = 'new-slug';
      component.save();

      // Wait for async resolution
      await new Promise((r) => setTimeout(r, 0));
      expect(component.successMessage()).toBe('Tenant settings updated successfully.');
      expect(component.saving()).toBe(false);
    });

    it('should set error message on failure', async () => {
      tenantStoreMock.updateTenant.mockRejectedValueOnce(new Error('fail'));
      component.name = 'New Name';
      component.slug = 'new-slug';
      component.save();

      await new Promise((r) => setTimeout(r, 0));
      expect(component.errorMessage()).toBe('Failed to update tenant settings.');
      expect(component.saving()).toBe(false);
    });
  });

  // ── deleteTenant ───────────────────────────────────────────────────────

  describe('deleteTenant', () => {
    beforeEach(() => setup());

    it('should not delete when confirm name does not match', () => {
      component.deleteConfirmName.set('Wrong Name');
      component.deleteTenant();

      expect(tenantStoreMock.deleteTenant).not.toHaveBeenCalled();
    });

    it('should delete tenant and navigate when confirm name matches', async () => {
      component.deleteConfirmName.set('Acme');
      component.deleteTenant();

      expect(tenantStoreMock.deleteTenant).toHaveBeenCalledWith('t1');

      await new Promise((r) => setTimeout(r, 0));
      expect(routerMock.navigate).toHaveBeenCalledWith(['/']);
    });

    it('should set error message on delete failure', async () => {
      tenantStoreMock.deleteTenant.mockRejectedValueOnce(new Error('fail'));
      component.deleteConfirmName.set('Acme');
      component.deleteTenant();

      await new Promise((r) => setTimeout(r, 0));
      expect(component.errorMessage()).toBe('Failed to delete tenant.');
      expect(component.deleting()).toBe(false);
    });
  });

  // ── onDialogStateChange ───────────────────────────────────────────────

  describe('onDialogStateChange', () => {
    beforeEach(() => setup());

    it('should close dialog and reset confirm name', () => {
      component.showDeleteDialog.set(true);
      component.deleteConfirmName.set('Acme');
      component.onDialogStateChange('closed');

      expect(component.showDeleteDialog()).toBe(false);
      expect(component.deleteConfirmName()).toBe('');
    });
  });
});
