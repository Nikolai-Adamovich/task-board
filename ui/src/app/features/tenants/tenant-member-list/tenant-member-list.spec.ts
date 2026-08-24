/**
 * Tests for the TenantMemberList component.
 *
 * Covers:
 * - Loading members on init
 * - inviteMember validation & submission
 * - changeRole
 * - removeMember
 * - revokeAccess / resendInvitation / hardDeleteMember
 * - restoreMembership / reinviteMember
 * - isOwner / getInitials
 * - getRoleColor / getStatusColor
 * - canManage computed
 * - onDialogStateChange
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
import { API_BASE_URL } from '@app/api-url.token';
import { NeutralColor } from '@app/constants/priority';
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

  function setup(role = 'OWNER') {
    tenantClientMock = {
      listMembers: vi.fn().mockReturnValue(of(mockMembers)),
      inviteMember: vi.fn().mockReturnValue(of(mockMembers[0])),
      updateMemberRole: vi.fn().mockReturnValue(of({ ...mockMembers[1], role: 'ADMIN' })),
      removeMember: vi.fn().mockReturnValue(of(undefined)),
      revokeAccess: vi.fn().mockReturnValue(of({ success: true })),
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

    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { en: {} } })],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: 'http://localhost/api' },
        { provide: TenantClient, useValue: tenantClientMock },
        { provide: AuthStore, useValue: authStoreMock },
      ],
    });

    const fixture = TestBed.createComponent(TenantMemberList);

    fixture.componentRef.setInput('tenantId', 't1');

    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  // ── Loading ─────────────────────────────────────────────────────

  describe('ngOnInit', () => {
    beforeEach(() => setup());

    it('should call tenantClient.listMembers', () => {
      expect(tenantClientMock.listMembers).toHaveBeenCalledWith('t1');
    });

    it('should populate members signal', () => {
      expect(component.members()).toEqual(mockMembers);
    });

    it('should set loading to false', () => {
      expect(component.loading()).toBe(false);
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

    it('should set actioningUserId to null on error', () => {
      tenantClientMock.inviteMember.mockReturnValueOnce(throwError(() => new Error('fail')));
      component.model.update((m: { email: string; role: string }) => ({ ...m, email: 'fail@example.com' }));
      submit(component.inviteForm);

      expect(component.actioningUserId()).toBe(null);
    });
  });

  // ── changeRole ─────────────────────────────────────────────────

  describe('changeRole', () => {
    beforeEach(() => setup());

    it('should not call API when role is unchanged', () => {
      component.changeRole(mockMembers[0], 'OWNER');
      expect(tenantClientMock.updateMemberRole).not.toHaveBeenCalled();
    });

    it('should not call API when newRole is null', () => {
      component.changeRole(mockMembers[1], null);
      expect(tenantClientMock.updateMemberRole).not.toHaveBeenCalled();
    });

    it('should call updateMemberRole when role changes', () => {
      component.changeRole(mockMembers[1], 'ADMIN');
      expect(tenantClientMock.updateMemberRole).toHaveBeenCalledWith('t1', 'u2', 'ADMIN');
    });
  });

  // ── removeMember ───────────────────────────────────────────────

  describe('removeMember', () => {
    beforeEach(() => setup());

    it('should remove member from list', () => {
      component.removeMember(mockMembers[1]);
      expect(tenantClientMock.removeMember).toHaveBeenCalledWith('t1', 'u2');
      expect(component.members().find((m: TenantMember) => m.userId === 'u2')).toBeUndefined();
    });
  });

  // ── revokeAccess ───────────────────────────────────────────────

  describe('revokeAccess', () => {
    beforeEach(() => setup());

    it('should call tenantClient.revokeAccess and update status', () => {
      component.revokeAccess(mockMembers[1]);
      expect(tenantClientMock.revokeAccess).toHaveBeenCalledWith('t1', 'u2');

      const updated = component.members().find((m: TenantMember) => m.userId === 'u2');

      expect(updated.status).toBe('ACCESS_REVOKED');
    });
  });

  // ── restoreMembership ──────────────────────────────────────────

  describe('restoreMembership', () => {
    beforeEach(() => setup());

    it('should call tenantClient.restoreMembership and update status', () => {
      // First revoke
      component.revokeAccess(mockMembers[1]);
      expect(component.members().find((m: TenantMember) => m.userId === 'u2')?.status).toBe('ACCESS_REVOKED');

      // Then restore
      component.restoreMembership({ ...mockMembers[1], status: 'ACCESS_REVOKED' });
      expect(tenantClientMock.restoreMembership).toHaveBeenCalledWith('t1', 'u2');
    });
  });

  // ── reinviteMember ─────────────────────────────────────────────

  describe('reinviteMember', () => {
    beforeEach(() => setup());

    it('should call tenantClient.reinviteMember', () => {
      component.reinviteMember(mockMembers[2]);
      expect(tenantClientMock.reinviteMember).toHaveBeenCalledWith('t1', 'u3');
    });
  });

  // ── hardDeleteMember ──────────────────────────────────────────────────

  describe('hardDeleteMember', () => {
    beforeEach(() => setup());

    it('should remove member from list', () => {
      component.hardDeleteMember(mockMembers[1]);
      expect(tenantClientMock.hardDeleteMember).toHaveBeenCalledWith('t1', 'u2');
      expect(component.members().find((m: TenantMember) => m.userId === 'u2')).toBeUndefined();
    });
  });

  // ── Helper methods ─────────────────────────────────────────────

  describe('helpers', () => {
    beforeEach(() => setup());

    it('isOwner should return true for owner', () => {
      expect(component.isOwner(mockMembers[0])).toBe(true);
    });

    it('isOwner should return false for non-owner', () => {
      expect(component.isOwner(mockMembers[1])).toBe(false);
    });

    it('getInitials should return first 2 chars uppercased', () => {
      expect(component.initials('abcdef')).toBe('AB');
    });

    it('getInitials should return ?? for null', () => {
      expect(component.initials(null)).toBe('??');
    });

    it('getRoleColor should return correct colors', () => {
      expect(component.roleBadgeClass('OWNER')).toBe('bg-purple-100 text-purple-700');
      expect(component.roleBadgeClass('ADMIN')).toBe('bg-blue-100 text-blue-700');
      expect(component.roleBadgeClass('MEMBER')).toBe('bg-gray-100 text-gray-600');
      expect(component.roleBadgeClass('unknown')).toBe(NeutralColor);
    });

    it('getStatusColor should return correct colors', () => {
      expect(component.memberStatusBadgeClass('ACTIVE')).toBe('bg-green-100 text-green-700');
      expect(component.memberStatusBadgeClass('PENDING')).toBe('bg-amber-100 text-amber-700');
      expect(component.memberStatusBadgeClass('DECLINED')).toBe('bg-red-100 text-red-700');
      expect(component.memberStatusBadgeClass('ACCESS_REVOKED')).toBe('bg-red-100 text-red-700');
      expect(component.memberStatusBadgeClass('unknown')).toBe(NeutralColor);
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

  // ── onDialogStateChange ───────────────────────────────────────

  describe('onDialogStateChange', () => {
    beforeEach(() => setup());

    it('should close dialog on closed state', () => {
      component.showInviteDialog.set(true);
      component.onDialogStateChange('closed');

      expect(component.showInviteDialog()).toBe(false);
    });
  });
});
