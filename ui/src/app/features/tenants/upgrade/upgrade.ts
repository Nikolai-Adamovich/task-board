import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { provideIcons, NgIcon } from '@ng-icons/core';
import { lucideCheck, lucideArrowLeft, lucideCrown } from '@ng-icons/lucide';
import { TenantStore } from '@stores/tenant-store';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';

@Component({
  selector: 'ui-upgrade',
  imports: [NgIcon, HlmButtonImports, HlmCardImports, HlmSpinnerImports, HlmBadgeImports],
  providers: [provideIcons({ lucideCheck, lucideArrowLeft, lucideCrown })],
  templateUrl: './upgrade.html',
})
export class Upgrade implements OnInit {
  private readonly router = inject(Router);
  private readonly tenantStore = inject(TenantStore);
  protected readonly upgrading = signal(false);
  protected readonly success = signal(false);
  protected readonly error = signal('');
  protected readonly currentPlan = computed(() => {
    const tenant = this.tenantStore.activeTenant();

    return tenant?.subscription ?? 'free';
  });

  ngOnInit(): void {
    // If already premium, show success state
    if (this.currentPlan() === 'premium') {
      this.success.set(true);
    }
  }

  protected upgrade(): void {
    const tenant = this.tenantStore.activeTenant();

    if (!tenant) return;

    this.upgrading.set(true);
    this.error.set('');

    this.tenantStore.updateTenant(tenant.id, { subscription: 'premium' }).then(
      () => {
        this.success.set(true);
        this.upgrading.set(false);
      },
      (err: unknown) => {
        const message = err instanceof HttpErrorResponse ? err.error?.message : 'Failed to upgrade. Please try again.';

        this.error.set(message);
        this.upgrading.set(false);
      },
    );
  }

  protected goBack(): void {
    const tenant = this.tenantStore.activeTenant();

    if (tenant) {
      this.router.navigate(['/tenants', tenant.id, 'settings']);
    } else {
      this.router.navigateByUrl('/');
    }
  }
}
