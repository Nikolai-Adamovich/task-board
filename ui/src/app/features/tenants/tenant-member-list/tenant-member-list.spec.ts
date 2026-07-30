/**
 * Tests for the TenantMemberList component.
 *
 * Covers:
 * - Loading members on init
 * - inviteMember validation & submission
 * - changeRole
 * - removeMember
 * - revokeAccess / resendInvitation / hardDeleteMember
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
import { TenantMemberList } from './tenant-member-list';
import { TenantClient } from '@services/tenant-client';
import { AuthStore } from '@stores/auth-store';
import { API_BASE_URL } from '@app/api-url.token';
import type { TenantMember } from '@task-board/shared';

const mockMembers: TenantMember[] = [
  {
    userId: 'u1',
    tenantId: 't1',
    role: 'owner',
    status: 'active',
    invitedEmail: null,
    invitationToken: null,
    invitedAt: null,
  },
  {
    userId: 'u2',
    tenantId: 't1',
    role: 'member',
    status: 'active',
    invitedEmail: null,
    invitationToken: null,
    invitedAt: null,
  },
  {
    userId: null,
    tenantId: 't1',
    role: 'member',
    status: 'pending',
    invitedEmail: 'pending@example.com',
    invitationToken: 'tok',
    invitedAt: '2025-01-01T00:00:00Z',
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
  };
  let authStoreMock: { tenantRole: ReturnType<typeof vi.fn> };

  function setup(role = 'owner') {
    tenantClientMock = {
      listMembers: vi.fn().mockReturnValue(of({ data: mockMembers })),
      inviteMember: vi.fn().mockReturnValue(of(mockMembers[0])),
      updateMemberRole: vi.fn().mockReturnValue(of({ ...mockMembers[1], role: 'admin' })),
      removeMember: vi.fn().mockReturnValue(of(undefined)),
      revokeAccess: vi.fn().mockReturnValue(of({ success: true })),
      resendInvitation: vi.fn().mockReturnValue(of({ success: true })),
      hardDeleteMember: vi.fn().mockReturnValue(of({ success: true })),
    };
    authStoreMock = {
      tenantRole: vi.fn().mockReturnValue(role),
    };

    TestBed.configureTestingModule({
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

  // ── Loading ─────────────────────────────────────────────────────────────

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

  // ── inviteMember ───────────────────────────────────────────────────────

  describe('inviteMember', () => {
    beforeEach(() => setup());

    it('should not invite when email is empty', () => {
      component.inviteEmail = '';
      component.inviteMember();
      expect(tenantClientMock.inviteMember).not.toHaveBeenCalled();
    });

    it('should call tenantClient.inviteMember', () => {
      component.inviteEmail = 'new@example.com';
      component.inviteRole = 'admin';
      component.inviteMember();

      expect(tenantClientMock.inviteMember).toHaveBeenCalledWith('t1', 'new@example.com', 'admin');
    });

    it('should reset form and close dialog on success', () => {
      component.inviteEmail = 'new@example.com';
      component.inviteMember();

      expect(component.showInviteDialog()).toBe(false);
      expect(component.inviteEmail).toBe('');
      expect(component.inviteRole).toBe('member');
    });

    it('should set inviting to false on error', () => {
      tenantClientMock.inviteMember.mockReturnValueOnce(throwError(() => new Error('fail')));
      component.inviteEmail = 'fail@example.com';
      component.inviteMember();

      expect(component.inviting()).toBe(false);
    });
  });

  // ── changeRole ─────────────────────────────────────────────────────────

  describe('changeRole', () => {
    beforeEach(() => setup());

    it('should not call API when role is unchanged', () => {
      component.changeRole(mockMembers[0], 'owner');
      expect(tenantClientMock.updateMemberRole).not.toHaveBeenCalled();
    });

    it('should not call API when newRole is null', () => {
      component.changeRole(mockMembers[1], null);
      expect(tenantClientMock.updateMemberRole).not.toHaveBeenCalled();
    });

    it('should call updateMemberRole when role changes', () => {
      component.changeRole(mockMembers[1], 'admin');
      expect(tenantClientMock.updateMemberRole).toHaveBeenCalledWith('t1', 'u2', 'admin');
    });
  });

  // ── removeMember ───────────────────────────────────────────────────────

  describe('removeMember', () => {
    beforeEach(() => setup());

    it('should not remove when userId is null', () => {
      component.removeMember(mockMembers[2]);
      expect(tenantClientMock.removeMember).not.toHaveBeenCalled();
    });

    it('should remove member from list', () => {
      component.removeMember(mockMembers[1]);
      expect(tenantClientMock.removeMember).toHaveBeenCalledWith('t1', 'u2');
      expect(component.members().find((m: TenantMember) => m.userId === 'u2')).toBeUndefined();
    });
  });

  // ── revokeAccess ───────────────────────────────────────────────────────

  describe('revokeAccess', () => {
    beforeEach(() => setup());

    it('should not revoke when userId is null', () => {
      component.revokeAccess(mockMembers[2]);
      expect(tenantClientMock.revokeAccess).not.toHaveBeenCalled();
    });

    it('should call tenantClient.revokeAccess and update status', () => {
      component.revokeAccess(mockMembers[1]);
      expect(tenantClientMock.revokeAccess).toHaveBeenCalledWith('t1', 'u2');

      const updated = component.members().find((m: TenantMember) => m.userId === 'u2');

      expect(updated.status).toBe('access_revoked');
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

  // ── Helper methods ─────────────────────────────────────────────────────

  describe('helpers', () => {
    beforeEach(() => setup());

    it('isOwner should return true for owner', () => {
      expect(component.isOwner(mockMembers[0])).toBe(true);
    });

    it('isOwner should return false for non-owner', () => {
      expect(component.isOwner(mockMembers[1])).toBe(false);
    });

    it('getInitials should return first 2 chars uppercased', () => {
      expect(component.getInitials('abcdef')).toBe('AB');
    });

    it('getInitials should return ?? for null', () => {
      expect(component.getInitials(null)).toBe('??');
    });

    it('getRoleColor should return correct colors', () => {
      expect(component.getRoleColor('owner')).toBe('bg-purple-100 text-purple-700');
      expect(component.getRoleColor('admin')).toBe('bg-blue-100 text-blue-700');
      expect(component.getRoleColor('member')).toBe('bg-gray-100 text-gray-600');
      expect(component.getRoleColor('unknown')).toBe('bg-gray-100 text-gray-600');
    });

    it('getStatusColor should return correct colors', () => {
      expect(component.getStatusColor('active')).toBe('bg-green-100 text-green-700');
      expect(component.getStatusColor('pending')).toBe('bg-amber-100 text-amber-700');
      expect(component.getStatusColor('declined')).toBe('bg-red-100 text-red-700');
      expect(component.getStatusColor('access_revoked')).toBe('bg-red-100 text-red-700');
      expect(component.getStatusColor('unknown')).toBe('bg-gray-100 text-gray-600');
    });
  });

  // ── canManage ──────────────────────────────────────────────────────────

  describe('canManage', () => {
    it('should be true for owner', () => {
      setup('owner');
      expect(component.canManage()).toBe(true);
    });

    it('should be true for admin', () => {
      setup('admin');
      expect(component.canManage()).toBe(true);
    });

    it('should be false for member', () => {
      setup('member');
      expect(component.canManage()).toBe(false);
    });
  });

  // ── onDialogStateChange ───────────────────────────────────────────────

  describe('onDialogStateChange', () => {
    beforeEach(() => setup());

    it('should close dialog and reset form on closed state', () => {
      component.showInviteDialog.set(true);
      component.inviteEmail = 'test@example.com';
      component.onDialogStateChange('closed');

      expect(component.showInviteDialog()).toBe(false);
      expect(component.inviteEmail).toBe('');
      expect(component.inviteRole).toBe('member');
    });
  });
});
