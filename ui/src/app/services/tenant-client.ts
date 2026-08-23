import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '@app/api-url.token';
import type {
  Tenant,
  CreateTenant,
  TenantMember,
  InvitationDetails,
  AcceptInvitation,
  AuthResponse,
} from '@task-board/shared';
import type { TenantWithRole, MyInvitation, PendingInvitation } from '@app/types/frontend';

/**
 * Pure HTTP client for tenant endpoints — no state management.
 * All methods return Observables; the TenantStore handles orchestration.
 */
@Service()
export class TenantClient {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  // ─── Tenant CRUD ──────────────────────────────────────────────────────────

  /** List all tenants for the current user (includes the caller's role per tenant). */
  listTenants(): Observable<TenantWithRole[]> {
    return this.http.get<{ data: TenantWithRole[] }>(`${this.apiBaseUrl}/tenants`).pipe(map((res) => res.data));
  }

  /** Create a new tenant. */
  createTenant(data: CreateTenant): Observable<Tenant> {
    return this.http.post<{ data: Tenant }>(`${this.apiBaseUrl}/tenants`, data).pipe(map((res) => res.data));
  }

  /** Update tenant name/description. */
  updateTenant(tenantId: string, data: { name?: string; description?: string }): Observable<Tenant> {
    return this.http
      .patch<{ data: Tenant }>(`${this.apiBaseUrl}/tenants/${tenantId}`, data)
      .pipe(map((res) => res.data));
  }

  /** Delete tenant (triggers DELETION_PENDING). */
  deleteTenant(tenantId: string): Observable<{ success: boolean }> {
    return this.http
      .delete<{ data: { success: boolean } }>(`${this.apiBaseUrl}/tenants/${tenantId}`)
      .pipe(map((res) => res.data));
  }

  // ─── Tenant Lifecycle ─────────────────────────────────────────────────────

  /** Archive a tenant. */
  archiveTenant(tenantId: string): Observable<{ success: boolean }> {
    return this.http
      .post<{ data: { success: boolean } }>(`${this.apiBaseUrl}/tenants/${tenantId}/archive`, {})
      .pipe(map((res) => res.data));
  }

  /** Restore an archived tenant. */
  restoreTenant(tenantId: string): Observable<{ success: boolean }> {
    return this.http
      .post<{ data: { success: boolean } }>(`${this.apiBaseUrl}/tenants/${tenantId}/restore`, {})
      .pipe(map((res) => res.data));
  }

  /** Cancel a pending deletion. */
  cancelDeletion(tenantId: string): Observable<{ success: boolean }> {
    return this.http
      .post<{ data: { success: boolean } }>(`${this.apiBaseUrl}/tenants/${tenantId}/cancel-deletion`, {})
      .pipe(map((res) => res.data));
  }

  // ─── Member Management ────────────────────────────────────────────────────

  /** List all members of a tenant. */
  listMembers(tenantId: string): Observable<TenantMember[]> {
    return this.http
      .get<{ data: TenantMember[] }>(`${this.apiBaseUrl}/tenants/${tenantId}/members`)
      .pipe(map((res) => res.data));
  }

  /** Invite a member by email with a role. */
  inviteMember(tenantId: string, email: string, role: string): Observable<TenantMember> {
    return this.http
      .post<{ data: TenantMember }>(`${this.apiBaseUrl}/tenants/${tenantId}/members/invite`, {
        email,
        role,
      })
      .pipe(map((res) => res.data));
  }

  /** Update a member's role. */
  updateMemberRole(tenantId: string, userId: string, role: string): Observable<TenantMember> {
    return this.http
      .patch<{ data: TenantMember }>(`${this.apiBaseUrl}/tenants/${tenantId}/members/${userId}`, { role })
      .pipe(map((res) => res.data));
  }

  /** Remove a member from the tenant. */
  removeMember(tenantId: string, userId: string): Observable<{ success: boolean }> {
    return this.http
      .delete<{ data: { success: boolean } }>(`${this.apiBaseUrl}/tenants/${tenantId}/members/${userId}`)
      .pipe(map((res) => res.data));
  }

  // ─── Invitation Flow ──────────────────────────────────────────────────────

  /** Get details of an invitation by its token (public, no auth required). */
  getInvitationDetails(token: string): Observable<InvitationDetails> {
    return this.http
      .get<{ data: InvitationDetails }>(`${this.apiBaseUrl}/auth/invitations/${token}`)
      .pipe(map((res) => res.data));
  }

  /** Accept an invitation (public, no auth required). Returns auth response. */
  acceptInvitation(body: AcceptInvitation): Observable<AuthResponse> {
    return this.http
      .post<{ data: AuthResponse }>(`${this.apiBaseUrl}/auth/accept-invitation`, body)
      .pipe(map((res) => res.data));
  }

  // ─── Cross-Tenant Invitation Management ───────────────────────────────────

  /** Get pending invitations for the current user (cross-tenant). */
  getMyInvitations(): Observable<MyInvitation[]> {
    return this.http.get<{ data: MyInvitation[] }>(`${this.apiBaseUrl}/invitations/my`).pipe(map((res) => res.data));
  }

  /** Get pending invitations for a tenant (owner/admin view). */
  getTenantPendingInvitations(tenantId: string): Observable<PendingInvitation[]> {
    return this.http
      .get<{ data: PendingInvitation[] }>(`${this.apiBaseUrl}/tenants/${tenantId}/invitations/pending`)
      .pipe(map((res) => res.data));
  }

  /** Decline an invitation. */
  declineInvitation(invitationId: string): Observable<{ success: boolean }> {
    return this.http
      .delete<{ data: { success: boolean } }>(`${this.apiBaseUrl}/invitations/${invitationId}`)
      .pipe(map((res) => res.data));
  }

  /** Accept an invitation by its ID (authenticated user accepting an existing invitation). */
  acceptInvitationById(invitationId: string): Observable<{ success: boolean }> {
    return this.http
      .post<{ data: { success: boolean } }>(`${this.apiBaseUrl}/invitations/${invitationId}/accept`, {})
      .pipe(map((res) => res.data));
  }

  // ─── Member Actions ───────────────────────────────────────────────────────

  /** Revoke a member's access. */
  revokeAccess(tenantId: string, memberId: string): Observable<{ success: boolean }> {
    return this.http
      .patch<{ data: { success: boolean } }>(`${this.apiBaseUrl}/tenants/${tenantId}/members/${memberId}/revoke`, {})
      .pipe(map((res) => res.data));
  }

  /** Resend an invitation. */
  resendInvitation(tenantId: string, memberId: string): Observable<{ success: boolean }> {
    return this.http
      .patch<{ data: { success: boolean } }>(`${this.apiBaseUrl}/tenants/${tenantId}/members/${memberId}/resend`, {})
      .pipe(map((res) => res.data));
  }

  /** Hard-delete a member. */
  hardDeleteMember(tenantId: string, memberId: string): Observable<{ success: boolean }> {
    return this.http
      .delete<{ data: { success: boolean } }>(`${this.apiBaseUrl}/tenants/${tenantId}/members/${memberId}/hard`)
      .pipe(map((res) => res.data));
  }

  /** Restore a member whose access was revoked. */
  restoreMembership(tenantId: string, memberId: string): Observable<{ success: boolean }> {
    return this.http
      .post<{ data: { success: boolean } }>(`${this.apiBaseUrl}/tenants/${tenantId}/members/${memberId}/restore`, {})
      .pipe(map((res) => res.data));
  }

  /** Reinvite a member (expired/revoked invitation). */
  reinviteMember(tenantId: string, memberId: string): Observable<{ success: boolean }> {
    return this.http
      .post<{ data: { success: boolean } }>(`${this.apiBaseUrl}/tenants/${tenantId}/members/${memberId}/reinvite`, {})
      .pipe(map((res) => res.data));
  }
}
