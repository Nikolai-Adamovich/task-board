/**
 * Tests for the ProjectMemberList component.
 *
 * Covers:
 * - Loading members on init (project id resolved from the ProjectStore context)
 * - V1-10/V2-1 regression: no request / no add when the project context is missing
 * - addMember submission
 * - changeRole (optimistic update with rollback + error toast)
 * - removeMember
 * - canManage computed (PROJECT_ADMIN+ / tenant ADMIN+ only)
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom, of, throwError } from 'rxjs';
import { submit } from '@angular/forms/signals';
import { TranslocoService, TranslocoTestingModule } from '@jsverse/transloco';
import { ProjectMemberList } from './project-member-list';
import { ProjectClient } from '@services/project-client';
import { AuthStore } from '@stores/auth-store';
import { ProjectStore } from '@stores/project-store';
import { API_BASE_URL } from '@app/api-url.token';
import type { ProjectMember } from '@task-board/shared';
import { settle } from '@app/shared/testing/zoneless';

const NOW = '2025-01-01T00:00:00Z';
const mockMembers: ProjectMember[] = [
  {
    id: 'pm1',
    projectId: 'p1',
    userId: 'u1',
    role: 'PROJECT_ADMIN',
    displayName: 'Admin User',
    email: 'admin@example.com',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'pm2',
    projectId: 'p1',
    userId: 'u2',
    role: 'EDITOR',
    displayName: 'Editor User',
    email: 'editor@example.com',
    createdAt: NOW,
    updatedAt: NOW,
  },
];

describe('ProjectMemberList', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let component: any;
  let projectClientMock: {
    listMembers: ReturnType<typeof vi.fn>;
    addMember: ReturnType<typeof vi.fn>;
    updateMemberRole: ReturnType<typeof vi.fn>;
    removeMember: ReturnType<typeof vi.fn>;
  };
  let authStoreMock: {
    tenantRole: ReturnType<typeof vi.fn>;
    isAuthenticated: () => boolean;
    currentUser: () => null;
    token: () => null;
  };
  let projectStoreMock: {
    activeProject: ReturnType<typeof vi.fn>;
    projectRole: ReturnType<typeof vi.fn>;
  };

  async function setup(
    projectRole = 'PROJECT_ADMIN',
    tenantRole = 'MEMBER',
    activeProject: { id: string } | null = { id: 'p1' },
  ) {
    projectClientMock = {
      listMembers: vi.fn().mockReturnValue(of(mockMembers)),
      addMember: vi.fn().mockReturnValue(of(mockMembers[0])),
      updateMemberRole: vi.fn().mockReturnValue(of({ ...mockMembers[1], role: 'VIEWER' })),
      removeMember: vi.fn().mockReturnValue(of(undefined)),
    };
    authStoreMock = {
      tenantRole: vi.fn().mockReturnValue(tenantRole),
      isAuthenticated: () => false,
      currentUser: () => null,
      token: () => null,
    };
    projectStoreMock = {
      activeProject: vi.fn().mockReturnValue(activeProject),
      projectRole: vi.fn().mockReturnValue(projectRole),
    };

    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ preloadLangs: true, langs: { en: {} } })],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: 'http://localhost/api' },
        { provide: ProjectClient, useValue: projectClientMock },
        { provide: AuthStore, useValue: authStoreMock },
        { provide: ProjectStore, useValue: projectStoreMock },
      ],
    });
    await firstValueFrom(TestBed.inject(TranslocoService).load('en'));

    const fixture = TestBed.createComponent(ProjectMemberList);

    component = fixture.componentInstance;
    await settle(fixture);
  }

  // ── Loading ─────────────────────────────────────────────────────

  describe('ngOnInit', () => {
    beforeEach(() => setup());

    it('should call projectClient.listMembers with the store-resolved project id', () => {
      expect(projectClientMock.listMembers).toHaveBeenCalledWith('p1');
    });

    it('should populate members signal', () => {
      expect(component.members()).toEqual(mockMembers);
    });

    it('should set loading to false', () => {
      expect(component.loading()).toBe(false);
    });
  });

  // ── V1-10/V2-1 regression: missing project context ─────────────

  describe('missing project context guard', () => {
    it('should not fetch members when no active project is resolved', async () => {
      await setup('PROJECT_ADMIN', 'MEMBER', null);

      expect(component.hasContext()).toBe(false);
      expect(projectClientMock.listMembers).not.toHaveBeenCalled();
      expect(component.members()).toEqual([]);
    });

    it('should not POST an added member when no active project is resolved', async () => {
      await setup('PROJECT_ADMIN', 'MEMBER', null);

      component.memberModel.update((m: { userId: string; role: string }) => ({ ...m, userId: 'u9' }));
      submit(component.addMemberForm);

      expect(projectClientMock.addMember).not.toHaveBeenCalled();
    });

    it('should not call updateMemberRole when no active project is resolved', async () => {
      await setup('PROJECT_ADMIN', 'MEMBER', null);

      component.changeRole({ userId: 'u2', role: 'EDITOR' }, 'VIEWER');

      expect(projectClientMock.updateMemberRole).not.toHaveBeenCalled();
    });
  });

  // ── addMember ──────────────────────────────────────────────────

  describe('addMember', () => {
    beforeEach(() => setup());

    it('should not add when userId is empty', () => {
      component.memberModel.update((m: { userId: string; role: string }) => ({ ...m, userId: '' }));
      submit(component.addMemberForm);
      expect(projectClientMock.addMember).not.toHaveBeenCalled();
    });

    it('should call projectClient.addMember and close dialog on success', () => {
      component.memberModel.update((m: { userId: string; role: string }) => ({ ...m, userId: 'u9' }));
      component.showAddMember.set(true);
      submit(component.addMemberForm);

      expect(projectClientMock.addMember).toHaveBeenCalledWith('p1', 'u9', 'EDITOR');
      expect(component.showAddMember()).toBe(false);
    });
  });

  // ── changeRole (optimistic + rollback) ─────────────────────────

  describe('changeRole', () => {
    beforeEach(() => setup());

    it('should not call API when role is unchanged', () => {
      component.changeRole({ userId: 'u2', role: 'EDITOR' }, 'EDITOR');
      expect(projectClientMock.updateMemberRole).not.toHaveBeenCalled();
    });

    it('should apply the change optimistically and call updateMemberRole', () => {
      component.changeRole({ userId: 'u2', role: 'EDITOR' }, 'VIEWER');

      // Optimistic: applied before the response arrives
      expect(component.members().find((m: ProjectMember) => m.userId === 'u2')?.role).toBe('VIEWER');
      expect(projectClientMock.updateMemberRole).toHaveBeenCalledWith('p1', 'u2', 'VIEWER');
    });

    it('should roll back the optimistic change on error', () => {
      projectClientMock.updateMemberRole.mockReturnValueOnce(throwError(() => new Error('forbidden')));

      component.changeRole({ userId: 'u2', role: 'EDITOR' }, 'VIEWER');

      expect(component.members().find((m: ProjectMember) => m.userId === 'u2')?.role).toBe('EDITOR');
    });
  });

  // ── removeMember ───────────────────────────────────────────────

  describe('removeMember', () => {
    beforeEach(() => setup());

    it('should call projectClient.removeMember and refresh the list', () => {
      component.removeMember({ userId: 'u2', role: 'EDITOR' });

      expect(projectClientMock.removeMember).toHaveBeenCalledWith('p1', 'u2');
      // loadMembers re-runs after removal
      expect(projectClientMock.listMembers).toHaveBeenCalledTimes(2);
    });
  });

  // ── canManage ──────────────────────────────────────────────────

  describe('canManage', () => {
    it('should be true for PROJECT_ADMIN', async () => {
      await setup('PROJECT_ADMIN');
      expect(component.canManage()).toBe(true);
    });

    it('should be true for a tenant ADMIN without a project role', async () => {
      await setup('VIEWER', 'ADMIN');
      expect(component.canManage()).toBe(true);
    });

    it('should be false for EDITOR', async () => {
      await setup('EDITOR');
      expect(component.canManage()).toBe(false);
    });

    it('should be false for VIEWER', async () => {
      await setup('VIEWER');
      expect(component.canManage()).toBe(false);
    });
  });
});
