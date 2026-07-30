import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { provideIcons, NgIcon } from '@ng-icons/core';
import { lucideCheck, lucideArrowLeft, lucideCrown } from '@ng-icons/lucide';
import { TenantClient } from '@services/tenant-client';
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
  private readonly tenantClient = inject(TenantClient);
  protected readonly upgrading = signal(false);
  protected readonly success = signal(false);
  protected readonly error = signal('');
  protected readonly currentPlan = computed(() => {
    const tenant = this.tenantClient.activeTenant();

    return tenant?.subscription ?? 'free';
  });

  ngOnInit(): void {
    // If already premium, show success state
    if (this.currentPlan() === 'premium') {
      this.success.set(true);
    }
  }

  protected upgrade(): void {
    const tenant = this.tenantClient.activeTenant();

    if (!tenant) return;

    this.upgrading.set(true);
    this.error.set('');

    this.tenantClient.updateTenant(tenant.id, { subscription: 'premium' }).subscribe({
      next: () => {
        this.success.set(true);
        this.upgrading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(err.error?.message ?? 'Failed to upgrade. Please try again.');
        this.upgrading.set(false);
      },
    });
  }

  protected goBack(): void {
    const tenant = this.tenantClient.activeTenant();

    if (tenant) {
      this.router.navigate(['/tenants', tenant.id, 'settings']);
    } else {
      this.router.navigateByUrl('/');
    }
  }
}
