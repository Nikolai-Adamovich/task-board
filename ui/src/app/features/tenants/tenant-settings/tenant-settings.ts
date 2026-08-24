import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { provideIcons, NgIcon } from '@ng-icons/core';
import {
  lucideSettings,
  lucideTrash2,
  lucideSave,
  lucideArchive,
  lucideRotateCcw,
  lucideXCircle,
} from '@ng-icons/lucide';
import { TenantStore } from '@stores/tenant-store';
import { AuthStore } from '@stores/auth-store';
import { TenantRole, TenantStatus } from '@task-board/shared';
import { statusBadgeClass } from '@app/constants/priority';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { form, FormField, FormRoot, schema, required } from '@angular/forms/signals';
import type { BrnDialogState } from '@spartan-ng/brain/dialog';
import { injectToasts } from '@app/shared/utils/toast-utils';
import { getErrorMessage } from '@app/shared/utils/error-utils';
import { HlmAlertImports } from '@spartan-ng/helm/alert';

@Component({
  selector: 'ui-tenant-settings',
  imports: [
    HlmAlertImports,
    TranslocoPipe,
    NgIcon,
    HlmButtonImports,
    HlmCardImports,
    HlmFieldImports,
    HlmInputImports,
    HlmSpinnerImports,
    HlmDialogImports,
    HlmBadgeImports,
    FormField,
    FormRoot,
  ],
  providers: [
    provideIcons({
      lucideSettings,
      lucideTrash2,
      lucideSave,
      lucideArchive,
      lucideRotateCcw,
      lucideXCircle,
    }),
  ],
  templateUrl: './tenant-settings.html',
})
export class TenantSettings implements OnInit {
  /** Shared badge-class helper (see constants/priority.ts) */
  protected readonly statusBadgeClass = statusBadgeClass;
  private readonly notify = injectToasts();
  private readonly tenantStore = inject(TenantStore);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly showDeleteDialog = signal(false);
  protected readonly deleteConfirmName = signal('');
  protected readonly TenantStatus = TenantStatus;
  /** Current tenant name, used for delete confirmation comparison */
  protected readonly currentTenantName = computed(() => this.tenantStore.activeTenant()?.name ?? '');
  protected readonly currentStatus = computed(() => this.tenantStore.activeTenant()?.status ?? TenantStatus.ACTIVE);
  private readonly tenantId = computed(() => this.tenantStore.activeTenant()?.id ?? null);
  protected readonly canEdit = computed(() => {
    const role = this.authStore.tenantRole();

    return role === TenantRole.OWNER || role === TenantRole.ADMIN;
  });
  private readonly model = signal<{ name: string }>({ name: '' });
  protected readonly settingsForm = form(
    this.model,
    schema<{ name: string }>((field) => {
      required(field.name, { message: 'validation.nameRequired' });
    }),
    {
      submission: {
        action: async () => {
          this.error.set('');

          const id = this.tenantId();

          if (!id) return;

          try {
            await this.tenantStore.updateTenant(id, { name: this.model().name });
            this.router.navigate(['/']);
          } catch (err) {
            this.error.set(getErrorMessage(err));
          }
        },
      },
    },
  );

  protected onDialogStateChange(state: BrnDialogState): void {
    if (state === 'closed') {
      this.showDeleteDialog.set(false);
      this.deleteConfirmName.set('');
    }
  }

  ngOnInit(): void {
    const tenant = this.tenantStore.activeTenant();

    if (tenant) {
      this.model.set({ name: tenant.name });
      this.loading.set(false);
    } else {
      this.loading.set(false);
    }
  }

  protected archiveTenant(): void {
    const id = this.tenantId();

    if (!id) return;

    this.tenantStore.archiveTenant(id).then(
      () => {
        this.notify.success('toasts.updated');
        this.router.navigate(['/']);
      },
      (err) => this.error.set(getErrorMessage(err)),
    );
  }

  protected restoreTenant(): void {
    const id = this.tenantId();

    if (!id) return;

    this.tenantStore.restoreTenant(id).then(
      () => this.notify.success('toasts.updated'),
      (err) => this.error.set(getErrorMessage(err)),
    );
  }

  protected deleteTenant(): void {
    const tenant = this.tenantStore.activeTenant();

    if (!tenant || this.deleteConfirmName() !== tenant.name) return;

    this.tenantStore.deleteTenant(tenant.id).then(
      () => {
        this.router.navigate(['/']);
      },
      (err) => {
        this.error.set(getErrorMessage(err));
      },
    );
  }

  protected cancelDeletion(): void {
    const id = this.tenantId();

    if (!id) return;

    this.tenantStore.cancelDeletion(id).catch((err) => {
      this.error.set(getErrorMessage(err));
    });
  }
}
