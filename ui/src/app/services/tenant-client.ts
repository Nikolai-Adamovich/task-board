import { Service, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { API_BASE_URL } from '@app/api-url.token';
import type { Tenant, TenantMember } from '@task-board/shared';

const TENANT_KEY = 'taskboard_tenant_id';

/**
 * Signal-based tenant client.
 * Manages the list of tenants, the active tenant selection,
 * and tenant/member CRUD operations.
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

  // ─── Tenant CRUD ──────────────────────────────────────────────────────────

  /** Update tenant name/slug */
  updateTenant(tenantId: string, data: { name?: string; slug?: string }): Observable<Tenant> {
    return this.http.patch<Tenant>(`${this.apiBaseUrl}/tenants/${tenantId}`, data).pipe(
      tap((updated) => {
        // Keep activeTenant and tenants list in sync
        if (this.activeTenant()?.id === tenantId) {
          this.activeTenant.set(updated);
        }
        this.tenants.update((list) => list.map((t) => (t.id === tenantId ? updated : t)));
      }),
    );
  }

  /** Delete tenant */
  deleteTenant(tenantId: string): Observable<void> {
    return (this.http.delete<null>(`${this.apiBaseUrl}/tenants/${tenantId}`) as unknown as Observable<void>).pipe(
      tap(() => {
        this.tenants.update((list) => list.filter((t) => t.id !== tenantId));
        if (this.activeTenant()?.id === tenantId) {
          const remaining = this.tenants();

          this.setActiveTenant(remaining.length > 0 ? remaining[0] : (null as unknown as Tenant));
        }
      }),
    );
  }

  // ─── Member Management ────────────────────────────────────────────────────

  /** List all members of a tenant */
  listMembers(tenantId: string): Observable<{ data: TenantMember[] }> {
    return this.http.get<{ data: TenantMember[] }>(`${this.apiBaseUrl}/tenants/${tenantId}/members`);
  }

  /** Invite a member by email with a role */
  inviteMember(tenantId: string, email: string, role: string): Observable<TenantMember> {
    return this.http.post<TenantMember>(`${this.apiBaseUrl}/tenants/${tenantId}/members`, { email, role });
  }

  /** Update a member's role */
  updateMemberRole(tenantId: string, userId: string, role: string): Observable<TenantMember> {
    return this.http.patch<TenantMember>(`${this.apiBaseUrl}/tenants/${tenantId}/members/${userId}`, { role });
  }

  /** Remove a member from the tenant */
  removeMember(tenantId: string, userId: string): Observable<void> {
    return this.http.delete<null>(
      `${this.apiBaseUrl}/tenants/${tenantId}/members/${userId}`,
    ) as unknown as Observable<void>;
  }
}
