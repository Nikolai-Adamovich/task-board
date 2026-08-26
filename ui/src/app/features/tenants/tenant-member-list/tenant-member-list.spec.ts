/**
 * Tests for the TenantMemberList component.
 *
 * Covers:
 * - Loading members on init (tenant id resolved from the TenantStore context)
 * - V1-10/V2-1 regression: no request / no invite when the tenant context is missing
 * - inviteMember validation & submission
 * - changeRole (optimistic update with rollback + error toast)
 * - removeMember
 * - revokeAccess / restoreMembership / reinviteMember / resendInvitation / hardDeleteMember
 * - canManage computed (Owner/Admin only)
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { submit } from '@angular/forms/signals';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { TenantMemberList } from './tenant-member-list';
import { TenantClient } from '@services/tenant-client';
import { AuthStore } from '@stores/auth-store';
import { TenantStore } from '@stores/tenant-store';
import { API_BASE_URL } from '@app/api-url.token';
import type { TenantMember } from '@task-board/shared';

const NOW = '2025-01-01T00:00:00Z';
const mockMembers: TenantMember[] = [
  {
    id: 'm1',
    tenantId: 't1',
    userId: 'u1',
    role: 'OWNER',
    status: 'ACTIVE',
    invitation: null,
    displayName: 'Owner User',
    email: 'owner@example.com',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'm2',
    tenantId: 't1',
    userId: 'u2',
    role: 'MEMBER',
    status: 'ACTIVE',
    invitation: null,
    displayName: 'Member User',
    email: 'member@example.com',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'm3',
    tenantId: 't1',
    userId: 'u3',
    role: 'MEMBER',
    status: 'ACTIVE',
    invitation: {
      status: 'PENDING',
      tokenHash: 'hash',
      invitedBy: 'u1',
      invitedOn: NOW,
    },
    displayName: null,
    email: null,
    createdAt: NOW,
    updatedAt: NOW,
  },
];

describe('TenantMemberList', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let component: any;
  let tenantClientMock: {
    listMembers: ReturnType<typeof vi.fn>;
    inviteMember: ReturnType<typeof vi.fn>;
    updateMemberRole: ReturnType<typeof vi.fn>;
    removeMember: ReturnType<typeof vi.fn>;
    revokeAccess: ReturnType<typeof vi.fn>;
    revokeInvitation: ReturnType<typeof vi.fn>;
    resendInvitation: ReturnType<typeof vi.fn>;
    hardDeleteMember: ReturnType<typeof vi.fn>;
    restoreMembership: ReturnType<typeof vi.fn>;
    reinviteMember: ReturnType<typeof vi.fn>;
  };
  let authStoreMock: {
    tenantRole: ReturnType<typeof vi.fn>;
    isAuthenticated: () => boolean;
    currentUser: () => null;
    token: () => null;
  };
  let tenantStoreMock: { activeTenant: ReturnType<typeof vi.fn> };

  function setup(role = 'OWNER', activeTenant: { id: string } | null = { id: 't1' }) {
    tenantClientMock = {
      listMembers: vi.fn().mockReturnValue(of(mockMembers)),
      inviteMember: vi.fn().mockReturnValue(of(mockMembers[0])),
      updateMemberRole: vi.fn().mockReturnValue(of({ ...mockMembers[1], role: 'ADMIN' })),
      removeMember: vi.fn().mockReturnValue(of(undefined)),
      revokeAccess: vi.fn().mockReturnValue(of({ success: true })),
      revokeInvitation: vi.fn().mockReturnValue(of({ success: true })),
      resendInvitation: vi.fn().mockReturnValue(of({ success: true })),
      hardDeleteMember: vi.fn().mockReturnValue(of({ success: true })),
      restoreMembership: vi.fn().mockReturnValue(of({ success: true })),
      reinviteMember: vi.fn().mockReturnValue(of({ success: true })),
    };
    authStoreMock = {
      tenantRole: vi.fn().mockReturnValue(role),
      isAuthenticated: () => false,
      currentUser: () => null,
      token: () => null,
    };
    tenantStoreMock = { activeTenant: vi.fn().mockReturnValue(activeTenant) };

    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { en: {} } })],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: 'http://localhost/api' },
        { provide: TenantClient, useValue: tenantClientMock },
        { provide: AuthStore, useValue: authStoreMock },
        { provide: TenantStore, useValue: tenantStoreMock },
      ],
    });

    const fixture = TestBed.createComponent(TenantMemberList);

    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  // ── Loading ─────────────────────────────────────────────────────

  describe('ngOnInit', () => {
    beforeEach(() => setup());

    it('should call tenantClient.listMembers with the store-resolved tenant id', () => {
      expect(tenantClientMock.listMembers).toHaveBeenCalledWith('t1');
    });

    it('should populate members signal', () => {
      expect(component.members()).toEqual(mockMembers);
    });

    it('should set loading to false', () => {
      expect(component.loading()).toBe(false);
    });
  });

  // ── V1-10/V2-1 regression: missing tenant context ──────────────

  describe('missing tenant context guard', () => {
    it('should not fetch members when no active tenant is resolved', () => {
      setup('OWNER', null);

      expect(component.hasContext()).toBe(false);
      expect(tenantClientMock.listMembers).not.toHaveBeenCalled();
      expect(component.members()).toEqual([]);
    });

    it('should not POST an invite when no active tenant is resolved', () => {
      setup('OWNER', null);

      component.model.update((m: { email: string; role: string }) => ({ ...m, email: 'new@example.com' }));
      submit(component.inviteForm);

      expect(tenantClientMock.inviteMember).not.toHaveBeenCalled();
    });

    it('should not call updateMemberRole when no active tenant is resolved', () => {
      setup('OWNER', null);

      component.changeRole({ userId: 'u2', role: 'MEMBER' }, 'ADMIN');

      expect(tenantClientMock.updateMemberRole).not.toHaveBeenCalled();
    });
  });

  // ── inviteMember ───────────────────────────────────────────────

  describe('inviteMember', () => {
    beforeEach(() => setup());

    it('should not invite when email is empty', () => {
      component.model.update((m: { email: string; role: string }) => ({ ...m, email: '' }));
      submit(component.inviteForm);
      expect(tenantClientMock.inviteMember).not.toHaveBeenCalled();
    });

    it('should call tenantClient.inviteMember', () => {
      component.model.update((m: { email: string; role: string }) => ({ ...m, email: 'new@example.com' }));
      component.model.update((m: { email: string; role: string }) => ({ ...m, role: 'ADMIN' }));
      submit(component.inviteForm);

      expect(tenantClientMock.inviteMember).toHaveBeenCalledWith('t1', 'new@example.com', 'ADMIN');
    });

    it('should reset form and close dialog on success', () => {
      component.model.update((m: { email: string; role: string }) => ({ ...m, email: 'new@example.com' }));
      submit(component.inviteForm);

      expect(component.showInviteDialog()).toBe(false);
      expect(component.model().email).toBe('');
      expect(component.model().role).toBe('MEMBER');
    });
  });

  // ── changeRole (optimistic + rollback) ─────────────────────────

  describe('changeRole', () => {
    beforeEach(() => setup());

    it('should not call API when role is unchanged', () => {
      component.changeRole({ userId: 'u1', role: 'OWNER' }, 'OWNER');
      expect(tenantClientMock.updateMemberRole).not.toHaveBeenCalled();
    });

    it('should apply the change optimistically and call updateMemberRole', () => {
      component.changeRole({ userId: 'u2', role: 'MEMBER' }, 'ADMIN');

      // Optimistic: applied before the response arrives
      expect(component.members().find((m: TenantMember) => m.userId === 'u2')?.role).toBe('ADMIN');
      expect(tenantClientMock.updateMemberRole).toHaveBeenCalledWith('t1', 'u2', 'ADMIN');
    });

    it('should roll back the optimistic change on error', () => {
      tenantClientMock.updateMemberRole.mockReturnValueOnce(throwError(() => new Error('forbidden')));

      component.changeRole({ userId: 'u2', role: 'MEMBER' }, 'ADMIN');

      expect(component.members().find((m: TenantMember) => m.userId === 'u2')?.role).toBe('MEMBER');
    });
  });

  // ── removeMember ───────────────────────────────────────────────

  describe('removeMember', () => {
    beforeEach(() => setup());

    it('should remove member from list', () => {
      component.removeMember({ userId: 'u2', role: 'MEMBER' });
      expect(tenantClientMock.removeMember).toHaveBeenCalledWith('t1', 'u2');
      expect(component.members().find((m: TenantMember) => m.userId === 'u2')).toBeUndefined();
    });
  });

  // ── revokeAccess ───────────────────────────────────────────────

  describe('revokeAccess (V2-7 dispatch)', () => {
    beforeEach(() => setup());

    it('should call tenantClient.revokeAccess for an ACTIVE member and reload the list', () => {
      const callsBefore = tenantClientMock.listMembers.mock.calls.length;

      component.revokeAccess({ userId: 'u2', role: 'MEMBER', status: 'ACTIVE' });

      expect(tenantClientMock.revokeAccess).toHaveBeenCalledWith('t1', 'u2');
      expect(tenantClientMock.revokeInvitation).not.toHaveBeenCalled();
      expect(tenantClientMock.listMembers.mock.calls.length).toBe(callsBefore + 1);
    });

    it('should route a PENDING invitation to the dedicated invitation-revoke endpoint', () => {
      component.revokeAccess({ userId: 'u4', role: 'MEMBER', invitationStatus: 'PENDING' });

      expect(tenantClientMock.revokeInvitation).toHaveBeenCalledWith('t1', 'u4');
      expect(tenantClientMock.revokeAccess).not.toHaveBeenCalled();
    });
  });

  // ── restoreMembership ──────────────────────────────────────────

  describe('restoreMembership', () => {
    beforeEach(() => setup());

    it('should call tenantClient.restoreMembership and update status', () => {
      component.restoreMembership({ userId: 'u2', role: 'MEMBER', status: 'ACCESS_REVOKED' });

      expect(tenantClientMock.restoreMembership).toHaveBeenCalledWith('t1', 'u2');
      expect(component.members().find((m: TenantMember) => m.userId === 'u2')?.status).toBe('ACTIVE');
    });
  });

  // ── reinviteMember ─────────────────────────────────────────────

  describe('reinviteMember', () => {
    beforeEach(() => setup());

    it('should call tenantClient.reinviteMember', () => {
      component.reinviteMember({ userId: 'u3', role: 'MEMBER' });
      expect(tenantClientMock.reinviteMember).toHaveBeenCalledWith('t1', 'u3');
    });
  });

  // ── hardDeleteMember ───────────────────────────────────────────

  describe('hardDeleteMember', () => {
    beforeEach(() => setup());

    it('should remove member from list', () => {
      component.hardDeleteMember({ userId: 'u2', role: 'MEMBER' });
      expect(tenantClientMock.hardDeleteMember).toHaveBeenCalledWith('t1', 'u2');
      expect(component.members().find((m: TenantMember) => m.userId === 'u2')).toBeUndefined();
    });
  });

  // ── canManage ──────────────────────────────────────────────────

  describe('canManage', () => {
    it('should be true for OWNER', () => {
      setup('OWNER');
      expect(component.canManage()).toBe(true);
    });

    it('should be true for ADMIN', () => {
      setup('ADMIN');
      expect(component.canManage()).toBe(true);
    });

    it('should be false for MEMBER', () => {
      setup('MEMBER');
      expect(component.canManage()).toBe(false);
    });
  });
});
