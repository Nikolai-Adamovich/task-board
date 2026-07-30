import { Service, signal, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TenantClient } from '@services/tenant-client';
import type { TenantWithRole, CreateTenant } from '@task-board/shared';

const TENANT_KEY = 'taskboard_tenant_id';

/**
 * Signal-based tenant store.
 * Manages the list of tenants and the active tenant selection.
 * Uses TenantClient for all HTTP calls — the store only handles orchestration and state.
 */
@Service()
export class TenantStore {
  private readonly tenantClient = inject(TenantClient);
  readonly tenants = signal<TenantWithRole[]>([]);
  readonly activeTenant = signal<TenantWithRole | null>(null);

  /** Load all tenants for the current user and restore active tenant from localStorage. */
  async loadTenants(): Promise<TenantWithRole[]> {
    const res = await firstValueFrom(this.tenantClient.listTenants());

    this.tenants.set(res.data);

    // Restore active tenant from localStorage
    const storedId = localStorage.getItem(TENANT_KEY);

    if (storedId) {
      const match = res.data.find((t) => t.id === storedId);

      if (match) {
        this.activeTenant.set(match);
      }
    }
    // Default to first tenant if none selected
    if (!this.activeTenant() && res.data.length > 0) {
      this.setActiveTenant(res.data[0]);
    }

    return res.data;
  }

  /** Create a new tenant, add it to the list, and set as active. */
  async createTenant(data: CreateTenant): Promise<TenantWithRole> {
    const tenant = await firstValueFrom(this.tenantClient.createTenant(data));
    // Creator is always the owner
    const tenantWithRole: TenantWithRole = { ...tenant, role: 'owner' };

    this.tenants.update((list) => [...list, tenantWithRole]);
    this.setActiveTenant(tenantWithRole);
    return tenantWithRole;
  }

  /** Update tenant name/slug/description/subscription and keep the store in sync. */
  async updateTenant(
    tenantId: string,
    data: { name?: string; slug?: string; description?: string; subscription?: string },
  ): Promise<TenantWithRole> {
    const updated = await firstValueFrom(this.tenantClient.updateTenant(tenantId, data));
    const existing = this.tenants().find((t) => t.id === tenantId);
    const updatedWithRole: TenantWithRole = { ...updated, role: existing?.role ?? 'member' };

    if (this.activeTenant()?.id === tenantId) {
      this.activeTenant.set(updatedWithRole);
    }
    this.tenants.update((list) => list.map((t) => (t.id === tenantId ? updatedWithRole : t)));

    return updatedWithRole;
  }

  /** Delete a tenant and update the store. */
  async deleteTenant(tenantId: string): Promise<void> {
    await firstValueFrom(this.tenantClient.deleteTenant(tenantId));
    this.tenants.update((list) => list.filter((t) => t.id !== tenantId));

    if (this.activeTenant()?.id === tenantId) {
      const remaining = this.tenants();

      if (remaining.length > 0) {
        this.setActiveTenant(remaining[0]);
      } else {
        this.activeTenant.set(null);
        localStorage.removeItem(TENANT_KEY);
      }
    }
  }

  /** Set the active tenant and persist to localStorage. */
  setActiveTenant(tenant: TenantWithRole): void {
    this.activeTenant.set(tenant);
    localStorage.setItem(TENANT_KEY, tenant.id);
  }
}
