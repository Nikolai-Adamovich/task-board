/**
 * Tests for the CreateWorkspace onboarding wizard (DEC-022).
 *
 * Covers:
 * - Signal form field validation (name, slug)
 * - Slug auto-generation from the workspace name (+ manual-edit override)
 * - Debounced live slug availability check
 * - Step flow: details → plan → checkout → confirmation
 * - Billing boundary is completed before the tenant is created
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { of } from 'rxjs';
import { CreateWorkspace } from './create-workspace';
import { TenantStore } from '@stores/tenant-store';
import { AuthStore } from '@stores/auth-store';
import { BillingClient, CheckoutContext, FREE_PLAN_ID } from '@services/billing-client';
import { API_BASE_URL } from '@app/api-url.token';
import type { TenantWithRole } from '@app/types/frontend';

const NOW = '2025-01-01T00:00:00Z';
const mockTenant: TenantWithRole = {
  id: 't1',
  name: 'NewCo',
  slug: 'newco',
  description: null,
  status: 'ACTIVE',
  deletionScheduledAt: null,
  role: 'OWNER',
  createdAt: NOW,
  updatedAt: NOW,
};

/** Wait for the slug availability debounce (300ms) plus a tick. */
async function waitForSlugDebounce(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 350));
}

describe('CreateWorkspace', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let component: any;
  let fixture: ReturnType<typeof TestBed.createComponent<CreateWorkspace>>;
  let httpMock: HttpTestingController;
  let tenantStoreMock: {
    createTenant: ReturnType<typeof vi.fn>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } & Record<string, any>;
  let authStoreMock: {
    setTenantContext: ReturnType<typeof vi.fn>;
  };
  let billingMock: {
    completeMockCheckout: ReturnType<typeof vi.fn>;
  };
  let routerMock: { navigateByUrl: ReturnType<typeof vi.fn> };

  function setup() {
    tenantStoreMock = {
      createTenant: vi.fn().mockResolvedValue(mockTenant),
    };
    authStoreMock = {
      setTenantContext: vi.fn(),
    };
    billingMock = {
      completeMockCheckout: vi.fn((planId: string, context: CheckoutContext) => {
        void context;

        return of({ status: 'active' as const, plan: planId });
      }),
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
        { provide: BillingClient, useValue: billingMock },
        { provide: Router, useValue: routerMock },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CreateWorkspace);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  /** Fill the name, wait out the debounce, and answer the availability check. */
  async function fillNameAndCheckSlug(name: string, available: boolean): Promise<void> {
    component.model.update((m: { name: string }) => ({ ...m, name }));
    fixture.detectChanges();
    await waitForSlugDebounce();

    const req = httpMock.expectOne((r) => r.url.includes('/tenants/slug-available'));

    expect(req.request.method).toBe('GET');
    req.flush({ data: { available } });
    fixture.detectChanges();
  }

  /** Dispatch a submit event on the details-step form (runs the submission action). */
  async function submitDetailsForm(): Promise<void> {
    const formEl = fixture.nativeElement.querySelector('form');

    formEl.dispatchEvent(new Event('submit'));
    await Promise.resolve();
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

  // ── slug generation & validation ───────────────────────────────────────

  describe('slug field', () => {
    beforeEach(() => setup());

    it('should auto-generate the slug from the workspace name', async () => {
      component.model.update((m: { name: string }) => ({ ...m, name: 'My Workspace!' }));
      fixture.detectChanges();
      await waitForSlugDebounce();

      expect(component.model().slug).toBe('my-workspace');
      httpMock.expectOne((r) => r.url.includes('/tenants/slug-available')).flush({ data: { available: true } });
    });

    it('should stop auto-generating once the user edits the slug manually', async () => {
      component.markSlugEdited();
      component.model.update((m: { name: string; slug: string }) => ({ ...m, slug: 'custom-slug' }));
      fixture.detectChanges();
      await waitForSlugDebounce();

      component.model.update((m: { name: string }) => ({ ...m, name: 'Another Name' }));
      fixture.detectChanges();
      await waitForSlugDebounce();

      expect(component.model().slug).toBe('custom-slug');
      httpMock.expectOne((r) => r.url.includes('/tenants/slug-available')).flush({ data: { available: true } });
    });

    it('should be invalid for a slug violating the slug rules', () => {
      component.markSlugEdited();
      component.model.update((m: { name: string; slug: string }) => ({ ...m, slug: 'Bad Slug!' }));
      fixture.detectChanges();

      expect(component.workspaceForm.slug().invalid()).toBe(true);
      expect(component.workspaceForm.slug().errors()[0].kind).toBe('pattern');
    });

    it('should reflect an unavailable slug from the live check', async () => {
      await fillNameAndCheckSlug('Taken Co', false);

      expect(component.slugAvailability()).toBe('taken');
    });

    it('should reflect an available slug from the live check', async () => {
      await fillNameAndCheckSlug('Free Co', true);

      expect(component.slugAvailability()).toBe('available');
    });
  });

  // ── step flow ──────────────────────────────────────────────────────────

  describe('step flow', () => {
    beforeEach(() => setup());

    it('should start on the details step', () => {
      expect(component.step()).toBe('details');
    });

    it('should block advancing while the slug is taken', async () => {
      await fillNameAndCheckSlug('Taken Co', false);
      await submitDetailsForm();

      expect(component.step()).toBe('details');
    });

    it('should advance details → plan → checkout and keep state', async () => {
      await fillNameAndCheckSlug('NewCo', true);
      await submitDetailsForm();

      expect(component.step()).toBe('plan');

      component.goToCheckout();
      expect(component.step()).toBe('checkout');

      // State preserved across steps
      expect(component.model().name).toBe('NewCo');
      expect(component.model().slug).toBe('newco');
    });

    it('should support going back between steps without losing state', async () => {
      await fillNameAndCheckSlug('NewCo', true);
      await submitDetailsForm();
      component.goToCheckout();

      component.goBack();
      expect(component.step()).toBe('plan');

      component.goBack();
      expect(component.step()).toBe('details');
      expect(component.model().name).toBe('NewCo');
    });

    it('should complete the mock checkout before creating the tenant, then navigate', async () => {
      await fillNameAndCheckSlug('NewCo', true);
      await submitDetailsForm();
      component.goToCheckout();

      component.confirmCheckout();
      // Billing mock resolves synchronously; allow promise chain to settle.
      await new Promise((resolve) => setTimeout(resolve, 0));
      fixture.detectChanges();

      expect(billingMock.completeMockCheckout).toHaveBeenCalledWith(FREE_PLAN_ID, {
        workspaceName: 'NewCo',
        slug: 'newco',
      });
      expect(tenantStoreMock.createTenant).toHaveBeenCalledWith({
        name: 'NewCo',
        slug: 'newco',
        description: undefined,
      });
      expect(billingMock.completeMockCheckout.mock.invocationCallOrder[0]).toBeLessThan(
        tenantStoreMock.createTenant.mock.invocationCallOrder[0],
      );
      expect(authStoreMock.setTenantContext).toHaveBeenCalledWith(mockTenant.id, 'OWNER');
      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/');
      expect(component.step()).toBe('confirmation');
    });

    it('should stay on checkout when tenant creation fails so the user can retry', async () => {
      tenantStoreMock.createTenant.mockRejectedValueOnce(new Error('boom'));

      await fillNameAndCheckSlug('NewCo', true);
      await submitDetailsForm();
      component.goToCheckout();

      component.confirmCheckout();
      await new Promise((resolve) => setTimeout(resolve, 0));
      fixture.detectChanges();

      expect(component.step()).toBe('checkout');
      expect(routerMock.navigateByUrl).not.toHaveBeenCalled();
    });
  });
});
