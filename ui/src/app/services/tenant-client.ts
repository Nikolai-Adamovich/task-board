import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@app/api-url.token';
import type {
  Tenant,
  CreateTenant,
  TenantMember,
  InvitationDetails,
  AcceptInvitation,
  AuthResponse,
  MyInvitation,
  PendingInvitation,
} from '@task-board/shared';

/**
 * Pure HTTP client for tenant endpoints — no state management.
 * All methods return Observables; the TenantStore handles orchestration.
 */
@Service()
export class TenantClient {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  // ─── Tenant CRUD ──────────────────────────────────────────────────────────

  /** List all tenants for the current user. */
  listTenants(): Observable<{ data: Tenant[] }> {
    return this.http.get<{ data: Tenant[] }>(`${this.apiBaseUrl}/tenants`);
  }

  /** Create a new tenant. */
  createTenant(data: CreateTenant): Observable<Tenant> {
    return this.http.post<Tenant>(`${this.apiBaseUrl}/tenants`, data);
  }

  /** Update tenant name/slug. */
  updateTenant(tenantId: string, data: { name?: string; slug?: string; subscription?: string }): Observable<Tenant> {
    return this.http.patch<Tenant>(`${this.apiBaseUrl}/tenants/${tenantId}`, data);
  }

  /** Delete tenant. */
  deleteTenant(tenantId: string): Observable<void> {
    return this.http.delete<null>(`${this.apiBaseUrl}/tenants/${tenantId}`) as unknown as Observable<void>;
  }

  // ─── Member Management ────────────────────────────────────────────────────

  /** List all members of a tenant. */
  listMembers(tenantId: string): Observable<{ data: TenantMember[] }> {
    return this.http.get<{ data: TenantMember[] }>(`${this.apiBaseUrl}/tenants/${tenantId}/members`);
  }

  /** Invite a member by email with a role. */
  inviteMember(tenantId: string, email: string, role: string): Observable<TenantMember> {
    return this.http.post<TenantMember>(`${this.apiBaseUrl}/tenants/${tenantId}/members`, { email, role });
  }

  /** Update a member's role. */
  updateMemberRole(tenantId: string, userId: string, role: string): Observable<TenantMember> {
    return this.http.patch<TenantMember>(`${this.apiBaseUrl}/tenants/${tenantId}/members/${userId}`, { role });
  }

  /** Remove a member from the tenant. */
  removeMember(tenantId: string, userId: string): Observable<void> {
    return this.http.delete<null>(
      `${this.apiBaseUrl}/tenants/${tenantId}/members/${userId}`,
    ) as unknown as Observable<void>;
  }

  // ─── Invitation Flow ──────────────────────────────────────────────────────

  /** Get details of an invitation by its token (public, no auth required). */
  getInvitationDetails(token: string): Observable<InvitationDetails> {
    return this.http.get<InvitationDetails>(`${this.apiBaseUrl}/auth/invitations/${token}`);
  }

  /** Accept an invitation (public, no auth required). Returns auth response. */
  acceptInvitation(body: AcceptInvitation): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiBaseUrl}/auth/accept-invitation`, body);
  }

  // ─── Cross-Tenant Invitation Management ───────────────────────────────────

  /** Get pending invitations for the current user (cross-tenant). */
  getMyInvitations(): Observable<{ data: MyInvitation[]; total: number }> {
    return this.http.get<{ data: MyInvitation[]; total: number }>(`${this.apiBaseUrl}/invitations/my`);
  }

  /** Get pending invitations for a tenant (owner/admin view). */
  getTenantPendingInvitations(tenantId: string): Observable<{ data: PendingInvitation[]; total: number }> {
    return this.http.get<{ data: PendingInvitation[]; total: number }>(
      `${this.apiBaseUrl}/tenants/${tenantId}/invitations/pending`,
    );
  }

  /** Decline an invitation. */
  declineInvitation(invitationId: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.apiBaseUrl}/invitations/${invitationId}`);
  }

  /** Accept an invitation by its ID (authenticated user accepting an existing invitation). */
  acceptInvitationById(invitationId: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.apiBaseUrl}/invitations/${invitationId}/accept`, {});
  }

  // ─── Member Actions ───────────────────────────────────────────────────────

  /** Revoke a member's access. */
  revokeAccess(tenantId: string, memberId: string): Observable<{ success: boolean }> {
    return this.http.patch<{ success: boolean }>(
      `${this.apiBaseUrl}/tenants/${tenantId}/members/${memberId}/revoke`,
      {},
    );
  }

  /** Resend an invitation. */
  resendInvitation(tenantId: string, memberId: string): Observable<{ success: boolean }> {
    return this.http.patch<{ success: boolean }>(
      `${this.apiBaseUrl}/tenants/${tenantId}/members/${memberId}/resend`,
      {},
    );
  }

  /** Hard-delete a member. */
  hardDeleteMember(tenantId: string, memberId: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.apiBaseUrl}/tenants/${tenantId}/members/${memberId}/hard`);
  }
}
