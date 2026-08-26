import { Component, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { TenantRole, generateSlugFromName, isValidTenantSlug } from '@task-board/shared';
import { form, FormField, FormRoot, schema, required, maxLength, validate } from '@angular/forms/signals';
import { TenantStore } from '@stores/tenant-store';
import { AuthStore } from '@stores/auth-store';
import { BillingClient, CheckoutContext, FREE_PLAN_ID } from '@services/billing-client';
import { TenantClient } from '@services/tenant-client';
import { getErrorMessage } from '@app/shared/utils/error-utils';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { provideIcons, NgIcon } from '@ng-icons/core';
import { lucideCheck } from '@ng-icons/lucide';

/** Steps of the first-tenant onboarding journey (DEC-022): details → plan → checkout → confirmation. */
type OnboardingStep = 'details' | 'plan' | 'checkout' | 'confirmation';

interface WorkspaceModel {
  name: string;
  description: string;
  slug: string;
}

/** Debounce for the live slug availability check. */
const SLUG_CHECK_DEBOUNCE_MS = 300;

@Component({
  imports: [
    HlmAlertImports,
    TranslocoPipe,
    FormField,
    FormRoot,
    HlmCardImports,
    HlmFieldImports,
    HlmInputImports,
    HlmTextareaImports,
    HlmButtonImports,
    HlmSpinnerImports,
    NgIcon,
  ],
  providers: [provideIcons({ lucideCheck })],
  selector: 'ui-create-workspace',
  templateUrl: './create-workspace.html',
})
export class CreateWorkspace {
  private readonly router = inject(Router);
  private readonly tenantStore = inject(TenantStore);
  private readonly authStore = inject(AuthStore);
  private readonly billing = inject(BillingClient);
  private readonly tenantClient = inject(TenantClient);
  protected readonly error = signal('');
  protected readonly step = signal<OnboardingStep>('details');
  protected readonly confirming = signal(false);
  protected readonly creating = signal(false);
  /** Live availability state of the slug field (debounced server check). */
  protected readonly slugAvailability = signal<'idle' | 'checking' | 'available' | 'taken'>('idle');
  /** Set once the user edits the slug by hand — stops auto-generation from the name. */
  private readonly slugManuallyEdited = signal(false);
  protected readonly model = signal<WorkspaceModel>({ name: '', description: '', slug: '' });
  protected readonly workspaceForm = form(
    this.model,
    schema<WorkspaceModel>((field) => {
      required(field.name, { message: 'validation.workspaceNameRequired' });
      maxLength(field.name, 100, { message: 'validation.nameMax' });
      validate(field.slug, ({ value }) => {
        const slug = value();

        if (!slug) {
          return { kind: 'required', message: 'createWorkspace.slug.required' };
        }
        if (!isValidTenantSlug(slug)) {
          return { kind: 'pattern', message: 'createWorkspace.slug.invalid' };
        }

        return undefined;
      });
    }),
    {
      submission: {
        action: async () => {
          this.error.set('');

          const availability = this.slugAvailability();

          if (availability === 'checking') {
            this.error.set('createWorkspace.slug.checking');
            return;
          }
          if (availability === 'taken') {
            this.error.set('createWorkspace.slug.taken');
            return;
          }

          this.step.set('plan');
        },
      },
    },
  );

  constructor() {
    // Auto-generate the slug from the workspace name until the user edits it manually.
    effect(() => {
      const name = this.model().name;

      if (this.slugManuallyEdited()) {
        return;
      }

      const generated = generateSlugFromName(name);

      if (generated !== this.model().slug) {
        this.model.update((m) => ({ ...m, slug: generated }));
      }
    });

    // Debounced live availability check against GET /api/tenants/slug-available.
    let lastCheckedSlug = '';

    effect((onCleanup) => {
      const slug = this.model().slug;

      if (!isValidTenantSlug(slug)) {
        this.slugAvailability.set('idle');
        lastCheckedSlug = '';
        return;
      }

      // Skip duplicate checks when unrelated model fields change but the slug stays the same.
      if (slug === lastCheckedSlug) {
        return;
      }
      lastCheckedSlug = slug;

      this.slugAvailability.set('checking');

      const timer = setTimeout(() => {
        this.tenantClient.isSlugAvailable(slug).subscribe({
          next: (available) => {
            // Ignore stale responses for a slug that has since changed.
            if (this.model().slug === slug) {
              this.slugAvailability.set(available ? 'available' : 'taken');
            }
          },
          error: () => {
            if (this.model().slug === slug) {
              this.slugAvailability.set('idle');
            }
          },
        });
      }, SLUG_CHECK_DEBOUNCE_MS);

      onCleanup(() => clearTimeout(timer));
    });
  }

  /** Called when the user types into the slug field — stops auto-generation. */
  protected markSlugEdited(): void {
    this.slugManuallyEdited.set(true);
  }

  protected goBack(): void {
    this.error.set('');

    if (this.step() === 'plan') {
      this.step.set('details');
    } else if (this.step() === 'checkout') {
      this.step.set('plan');
    }
  }

  protected goToCheckout(): void {
    this.error.set('');
    this.step.set('checkout');
  }

  /**
   * Complete the mock checkout at the billing boundary, show the confirmation
   * step, then create the tenant and navigate to its home.
   */
  protected confirmCheckout(): void {
    if (this.confirming()) {
      return;
    }

    this.error.set('');
    this.confirming.set(true);

    const context: CheckoutContext = { workspaceName: this.model().name, slug: this.model().slug };

    this.billing.completeMockCheckout(FREE_PLAN_ID, context).subscribe({
      next: () => {
        this.confirming.set(false);
        this.step.set('confirmation');
        void this.createTenantAndNavigate();
      },
      error: (err) => {
        this.confirming.set(false);
        this.error.set(getErrorMessage(err, 'createWorkspace.failed'));
      },
    });
  }

  private async createTenantAndNavigate(): Promise<void> {
    this.creating.set(true);

    try {
      const tenant = await this.tenantStore.createTenant({
        name: this.model().name,
        slug: this.model().slug || undefined,
        description: this.model().description || undefined,
      });

      this.authStore.setTenantContext(tenant.id, TenantRole.OWNER);

      await this.router.navigateByUrl('/');
    } catch (err) {
      this.error.set(getErrorMessage(err, 'createWorkspace.failed'));
      // Surface SLUG_TAKEN races etc. back on the checkout step so the user can adjust.
      this.step.set('checkout');
    } finally {
      this.creating.set(false);
    }
  }
}
