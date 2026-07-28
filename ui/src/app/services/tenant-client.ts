import { Service, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '@app/api-url.token';
import type { Tenant } from '@task-board/shared';

const TENANT_KEY = 'taskboard_tenant_id';

/**
 * Signal-based tenant client.
 * Manages the list of tenants and the active tenant selection.
 */
@Service()
export class TenantClient {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);
  readonly tenants = signal<Tenant[]>([]);
  readonly activeTenant = signal<Tenant | null>(null);

  constructor() {
    const storedId = localStorage.getItem(TENANT_KEY);

    if (storedId) {
      this.loadTenants();
    }
  }

  /** Load all tenants for the current user */
  loadTenants(): void {
    this.http.get<{ data: Tenant[] }>(`${this.apiBaseUrl}/tenants`).subscribe({
      next: (res) => {
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
      },
    });
  }

  /** Set the active tenant */
  setActiveTenant(tenant: Tenant): void {
    this.activeTenant.set(tenant);
    localStorage.setItem(TENANT_KEY, tenant.id);
  }
}
