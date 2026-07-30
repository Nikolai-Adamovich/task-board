/**
 * Tests for the Upgrade component.
 *
 * Covers:
 * - currentPlan computed
 * - upgrade method
 * - goBack navigation
 * - ngOnInit for already-premium users
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { Upgrade } from './upgrade';
import { TenantStore } from '@stores/tenant-store';
import { API_BASE_URL } from '@app/api-url.token';
import type { TenantWithRole } from '@task-board/shared';

const NOW = '2025-01-01T00:00:00Z';
const mockFreeTenant: TenantWithRole = {
  id: 't1',
  name: 'Acme',
  slug: 'acme',
  description: null,
  subscription: 'free',
  role: 'owner',
  createdAt: NOW,
  updatedAt: NOW,
};
const mockPremiumTenant: TenantWithRole = {
  ...mockFreeTenant,
  subscription: 'premium',
};

describe('Upgrade', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let component: any;
  let tenantStoreMock: {
    activeTenant: ReturnType<typeof vi.fn>;
    updateTenant: ReturnType<typeof vi.fn>;
  };
  let routerMock: { navigate: ReturnType<typeof vi.fn>; navigateByUrl: ReturnType<typeof vi.fn> };

  function setup(tenant: TenantWithRole | null = mockFreeTenant) {
    tenantStoreMock = {
      activeTenant: vi.fn().mockReturnValue(tenant),
      updateTenant: vi.fn().mockResolvedValue({ ...tenant, subscription: 'premium' }),
    };
    routerMock = {
      navigate: vi.fn().mockResolvedValue(true),
      navigateByUrl: vi.fn().mockResolvedValue(true),
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: 'http://localhost/api' },
        { provide: TenantStore, useValue: tenantStoreMock },
        { provide: Router, useValue: routerMock },
      ],
    });

    const fixture = TestBed.createComponent(Upgrade);

    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  // ── currentPlan ────────────────────────────────────────────────────────

  describe('currentPlan', () => {
    it('should return free for free tenant', () => {
      setup();
      expect(component.currentPlan()).toBe('free');
    });

    it('should return premium for premium tenant', () => {
      setup(mockPremiumTenant);
      expect(component.currentPlan()).toBe('premium');
    });
  });

  // ── ngOnInit ───────────────────────────────────────────────────────────

  describe('ngOnInit', () => {
    it('should set success to true when already premium', () => {
      setup(mockPremiumTenant);
      expect(component.success()).toBe(true);
    });

    it('should not set success for free plan', () => {
      setup();
      expect(component.success()).toBe(false);
    });
  });

  // ── upgrade ────────────────────────────────────────────────────────────

  describe('upgrade', () => {
    beforeEach(() => setup());

    it('should call tenantStore.updateTenant with premium subscription', () => {
      component.upgrade();

      expect(tenantStoreMock.updateTenant).toHaveBeenCalledWith('t1', { subscription: 'premium' });
    });

    it('should set success to true on success', async () => {
      component.upgrade();
      await new Promise((r) => setTimeout(r, 0));

      expect(component.success()).toBe(true);
      expect(component.upgrading()).toBe(false);
    });

    it('should set error on failure', async () => {
      tenantStoreMock.updateTenant.mockRejectedValueOnce(new Error('fail'));
      component.upgrade();
      await new Promise((r) => setTimeout(r, 0));

      expect(component.error()).toBe('Failed to upgrade. Please try again.');
      expect(component.upgrading()).toBe(false);
    });

    it('should not upgrade when no active tenant', () => {
      tenantStoreMock.activeTenant.mockReturnValue(null);
      component.upgrade();

      expect(tenantStoreMock.updateTenant).not.toHaveBeenCalled();
    });
  });

  // ── goBack ─────────────────────────────────────────────────────────────

  describe('goBack', () => {
    it('should navigate to tenant settings when tenant exists', () => {
      setup();
      component.goBack();

      expect(routerMock.navigate).toHaveBeenCalledWith(['/tenants', 't1', 'settings']);
    });

    it('should navigate to / when no active tenant', () => {
      tenantStoreMock = {
        activeTenant: vi.fn().mockReturnValue(null),
        updateTenant: vi.fn(),
      };
      routerMock = {
        navigate: vi.fn().mockResolvedValue(true),
        navigateByUrl: vi.fn().mockResolvedValue(true),
      };

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([]),
          { provide: API_BASE_URL, useValue: 'http://localhost/api' },
          { provide: TenantStore, useValue: tenantStoreMock },
          { provide: Router, useValue: routerMock },
        ],
      });

      const fixture = TestBed.createComponent(Upgrade);

      component = fixture.componentInstance;
      fixture.detectChanges();
      component.goBack();

      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/');
    });
  });
});
