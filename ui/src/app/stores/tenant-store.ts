import { Service, signal, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TenantRole, TenantStatus } from '@task-board/shared';
import { TenantClient } from '@services/tenant-client';
import type { CreateTenant } from '@task-board/shared';
import type { TenantWithRole } from '@app/types/frontend';

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
  /**
   * Whether the tenant list has been initialized for the CURRENT session
   * (via /auth/bootstrap or loadTenants). True even when the list is empty —
   * guards must not re-fetch /tenants for a user who legitimately has no
   * tenants. Reset to false on logout / session switch.
   */
  readonly tenantsLoaded = signal(false);

  /**
   * Seed the store from the /auth/bootstrap payload. REPLACES any previous
   * list (never merges) — a user who logs in after a logout must never see
   * the previous session's tenants.
   */
  seedFromBootstrap(tenants: TenantWithRole[]): void {
    this.tenants.set([...tenants]);
    this.restoreActiveTenant(tenants);
    this.tenantsLoaded.set(true);
  }

  /** Load all tenants for the current user and restore active tenant from localStorage. */
  async loadTenants(): Promise<TenantWithRole[]> {
    const tenants = await firstValueFrom(this.tenantClient.listTenants());

    this.tenants.set(tenants);
    this.restoreActiveTenant(tenants);
    this.tenantsLoaded.set(true);

    return tenants;
  }

  /** Clear all tenant state (logout / session switch). */
  clear(): void {
    this.tenants.set([]);
    this.activeTenant.set(null);
    this.tenantsLoaded.set(false);
    localStorage.removeItem(TENANT_KEY);
  }

  /**
   * Resolve the active tenant for a freshly loaded list: keep the current
   * selection if it is still valid, else restore from localStorage, else
   * default to the first tenant, else none.
   */
  private restoreActiveTenant(tenants: TenantWithRole[]): void {
    const current = this.activeTenant();

    if (current && tenants.some((t) => t.id === current.id)) {
      return;
    }

    const storedId = localStorage.getItem(TENANT_KEY);
    const match = storedId ? tenants.find((t) => t.id === storedId) : undefined;

    if (match) {
      this.activeTenant.set(match);
      return;
    }

    const first = tenants[0];

    if (first) {
      this.setActiveTenant(first);
      return;
    }

    this.activeTenant.set(null);
  }

  /** Create a new tenant, add it to the list, and set as active. */
  async createTenant(data: CreateTenant): Promise<TenantWithRole> {
    const tenant = await firstValueFrom(this.tenantClient.createTenant(data));
    // Creator is always the owner
    const tenantWithRole: TenantWithRole = { ...tenant, role: TenantRole.OWNER };

    this.tenants.update((list) => [...list, tenantWithRole]);
    this.setActiveTenant(tenantWithRole);
    return tenantWithRole;
  }

  /** Update tenant name/description and keep the store in sync. */
  async updateTenant(tenantId: string, data: { name?: string; description?: string }): Promise<TenantWithRole> {
    const updated = await firstValueFrom(this.tenantClient.updateTenant(tenantId, data));
    const existing = this.tenants().find((t) => t.id === tenantId);
    const updatedWithRole: TenantWithRole = { ...updated, role: existing?.role ?? TenantRole.MEMBER };

    if (this.activeTenant()?.id === tenantId) {
      this.activeTenant.set(updatedWithRole);
    }
    this.tenants.update((list) => list.map((t) => (t.id === tenantId ? updatedWithRole : t)));

    return updatedWithRole;
  }

  /** Delete a tenant (triggers DELETION_PENDING) and update the store. */
  async deleteTenant(tenantId: string): Promise<void> {
    await firstValueFrom(this.tenantClient.deleteTenant(tenantId));
    this.tenants.update((list) => list.filter((t) => t.id !== tenantId));

    if (this.activeTenant()?.id === tenantId) {
      const remaining = this.tenants();
      const next = remaining[0];

      if (next) {
        this.setActiveTenant(next);
      } else {
        this.activeTenant.set(null);
        localStorage.removeItem(TENANT_KEY);
      }
    }
  }

  /** Archive a tenant and update the store status. */
  async archiveTenant(tenantId: string): Promise<void> {
    await firstValueFrom(this.tenantClient.archiveTenant(tenantId));
    this.updateTenantStatus(tenantId, TenantStatus.ARCHIVED);
  }

  /** Restore an archived tenant and update the store status. */
  async restoreTenant(tenantId: string): Promise<void> {
    await firstValueFrom(this.tenantClient.restoreTenant(tenantId));
    this.updateTenantStatus(tenantId, TenantStatus.ACTIVE);
  }

  /** Cancel a pending deletion and update the store status. */
  async cancelDeletion(tenantId: string): Promise<void> {
    await firstValueFrom(this.tenantClient.cancelDeletion(tenantId));
    this.updateTenantStatus(tenantId, TenantStatus.ACTIVE);
  }

  /** Set the active tenant and persist to localStorage. */
  setActiveTenant(tenant: TenantWithRole): void {
    this.activeTenant.set(tenant);
    localStorage.setItem(TENANT_KEY, tenant.id);
  }

  /** Update the status of a tenant in the store. */
  private updateTenantStatus(tenantId: string, status: TenantStatus): void {
    this.tenants.update((list) =>
      list.map((t) => (t.id === tenantId ? { ...t, status, deletionScheduledAt: null } : t)),
    );

    if (this.activeTenant()?.id === tenantId) {
      this.activeTenant.update((t) => (t ? { ...t, status, deletionScheduledAt: null } : t));
    }
  }
}
