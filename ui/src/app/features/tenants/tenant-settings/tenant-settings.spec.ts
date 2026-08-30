/**
 * Tests for the TenantSettings component.
 *
 * Covers:
 * - Initialization from active tenant
 * - save method
 * - deleteTenant method
 * - canEdit computed
 * - onDialogStateChange
 * - archiveTenant / restoreTenant / cancelDeletion
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { submit } from '@angular/forms/signals';
import { TranslocoService, TranslocoTestingModule } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { settle } from '@app/shared/testing/zoneless';
import { TenantSettings } from './tenant-settings';
import { TenantStore } from '@stores/tenant-store';
import { AuthStore } from '@stores/auth-store';
import { API_BASE_URL } from '@app/api-url.token';
import type { TenantWithRole } from '@app/types/frontend';

const NOW = '2025-01-01T00:00:00Z';
const mockTenant: TenantWithRole = {
  id: 't1',
  name: 'Acme',
  slug: 'acme',
  description: 'Acme workspace description',
  status: 'ACTIVE',
  deletionScheduledAt: null,
  role: 'OWNER',
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
    archiveTenant: ReturnType<typeof vi.fn>;
    restoreTenant: ReturnType<typeof vi.fn>;
    cancelDeletion: ReturnType<typeof vi.fn>;
  };
  let authStoreMock: { tenantRole: ReturnType<typeof vi.fn> };
  let routerMock: { navigate: ReturnType<typeof vi.fn> };

  async function setup(role = 'OWNER') {
    tenantStoreMock = {
      activeTenant: vi.fn().mockReturnValue(mockTenant),
      updateTenant: vi.fn().mockResolvedValue({ ...mockTenant, name: 'Updated' }),
      deleteTenant: vi.fn().mockResolvedValue(undefined),
      archiveTenant: vi.fn().mockResolvedValue(undefined),
      restoreTenant: vi.fn().mockResolvedValue(undefined),
      cancelDeletion: vi.fn().mockResolvedValue(undefined),
    };
    authStoreMock = {
      tenantRole: vi.fn().mockReturnValue(role),
    };
    routerMock = { navigate: vi.fn().mockResolvedValue(true) };

    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { en: {} }, preloadLangs: true })],
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

    await firstValueFrom(TestBed.inject(TranslocoService).load('en'));

    const fixture = TestBed.createComponent(TenantSettings);

    component = fixture.componentInstance;
    await settle(fixture);
  }

  // ── Initialization ─────────────────────────────────────────────────────

  describe('ngOnInit', () => {
    beforeEach(() => setup());

    it('should populate name from active tenant', () => {
      expect(component.model().name).toBe('Acme');
    });

    it('should populate description from active tenant', () => {
      expect(component.model().description).toBe('Acme workspace description');
    });

    it('should set loading to false', () => {
      expect(component.loading()).toBe(false);
    });
  });

  // ── canEdit ────────────────────────────────────────────────────────────

  describe('canEdit', () => {
    it('should be true for OWNER', async () => {
      await setup('OWNER');
      expect(component.canEdit()).toBe(true);
    });

    it('should be true for ADMIN', async () => {
      await setup('ADMIN');
      expect(component.canEdit()).toBe(true);
    });

    it('should be false for MEMBER', async () => {
      await setup('MEMBER');
      expect(component.canEdit()).toBe(false);
    });
  });

  // ── save ───────────────────────────────────────────────────────────────

  describe('save', () => {
    beforeEach(() => setup());

    it('should call tenantStore.updateTenant with name and description', () => {
      component.model.update((m: { name: string; description: string }) => ({
        ...m,
        name: 'New Name',
        description: 'New description',
      }));
      submit(component.settingsForm);

      expect(tenantStoreMock.updateTenant).toHaveBeenCalledWith('t1', {
        name: 'New Name',
        description: 'New description',
      });
    });

    it('should not save when description exceeds 120 characters', () => {
      component.model.update((m: { name: string; description: string }) => ({
        ...m,
        description: 'x'.repeat(121),
      }));
      submit(component.settingsForm);

      expect(tenantStoreMock.updateTenant).not.toHaveBeenCalled();
    });

    it('should not save when name is empty', () => {
      component.model.update((m: { name: string }) => ({ ...m, name: '' }));
      submit(component.settingsForm);

      expect(tenantStoreMock.updateTenant).not.toHaveBeenCalled();
    });

    it('should navigate to home on success', async () => {
      component.model.update((m: { name: string }) => ({ ...m, name: 'New Name' }));
      submit(component.settingsForm);

      // Wait for async resolution
      await new Promise((r) => setTimeout(r, 0));
      expect(component.error()).toBe('');
      expect(routerMock.navigate).toHaveBeenCalledWith(['/']);
    });

    it('should set error message on failure', async () => {
      tenantStoreMock.updateTenant.mockRejectedValueOnce(new Error('fail'));
      component.model.update((m: { name: string }) => ({ ...m, name: 'New Name' }));
      submit(component.settingsForm);

      await new Promise((r) => setTimeout(r, 0));
      expect(component.error()).toBe('fail');
      expect(component.loading()).toBe(false);
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
      expect(component.error()).toBe('fail');
      expect(component.loading()).toBe(false);
    });
  });

  // ── archiveTenant ──────────────────────────────────────────────────────

  describe('archiveTenant', () => {
    beforeEach(() => setup());

    it('should call tenantStore.archiveTenant', () => {
      component.archiveTenant();
      expect(tenantStoreMock.archiveTenant).toHaveBeenCalledWith('t1');
    });
  });

  // ── restoreTenant ──────────────────────────────────────────────────────

  describe('restoreTenant', () => {
    beforeEach(() => setup());

    it('should call tenantStore.restoreTenant', () => {
      component.restoreTenant();
      expect(tenantStoreMock.restoreTenant).toHaveBeenCalledWith('t1');
    });
  });

  // ── cancelDeletion ─────────────────────────────────────────────────────

  describe('cancelDeletion', () => {
    beforeEach(() => setup());

    it('should call tenantStore.cancelDeletion', () => {
      component.cancelDeletion();
      expect(tenantStoreMock.cancelDeletion).toHaveBeenCalledWith('t1');
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
