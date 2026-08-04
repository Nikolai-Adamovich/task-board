/**
 * Tests for the ProjectDetail component.
 *
 * Covers:
 * - Loading project, boards, and members on init
 * - createBoard validation & submission
 * - addMember validation & submission
 * - onRoleChange
 * - confirmRemoveMember / removeMember
 * - Dialog state changes
 * - isAdmin computed signal
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { submit } from '@angular/forms/signals';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { ProjectDetail } from './project-detail';
import { ProjectClient } from '@services/project-client';
import { BoardClient } from '@services/board-client';
import { AuthStore } from '@stores/auth-store';
import { API_BASE_URL } from '@app/api-url.token';
import type { Project, Board, ProjectMember } from '@task-board/shared';

const NOW = '2025-01-01T00:00:00Z';
const mockProject: Project = {
  id: 'p0000000-0000-0000-0000-000000000001',
  tenantId: 't0000000-0000-0000-0000-000000000001',
  name: 'Test Project',
  slug: 'test-project',
  description: 'A project for testing',
  createdAt: NOW,
  updatedAt: NOW,
};
const mockBoards: Board[] = [
  {
    id: 'b1',
    tenantId: mockProject.tenantId,
    projectId: mockProject.id,
    name: 'Board 1',
    description: null,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'b2',
    tenantId: mockProject.tenantId,
    projectId: mockProject.id,
    name: 'Board 2',
    description: 'Second board',
    createdAt: NOW,
    updatedAt: NOW,
  },
];
const mockMembers: ProjectMember[] = [
  { userId: 'u1', projectId: mockProject.id, tenantId: mockProject.tenantId, role: 'admin' },
  { userId: 'u2', projectId: mockProject.id, tenantId: mockProject.tenantId, role: 'developer' },
];

describe('ProjectDetail', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let component: any;
  let projectClientMock: {
    getById: ReturnType<typeof vi.fn>;
    listMembers: ReturnType<typeof vi.fn>;
    addMember: ReturnType<typeof vi.fn>;
    updateMemberRole: ReturnType<typeof vi.fn>;
    removeMember: ReturnType<typeof vi.fn>;
  };
  let boardClientMock: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  let authStoreMock: { tenantRole: ReturnType<typeof vi.fn> };

  function setup() {
    projectClientMock = {
      getById: vi.fn().mockReturnValue(of(mockProject)),
      listMembers: vi.fn().mockReturnValue(of({ data: mockMembers })),
      addMember: vi.fn().mockReturnValue(of(mockMembers[0])),
      updateMemberRole: vi.fn().mockReturnValue(of(mockMembers[0])),
      removeMember: vi.fn().mockReturnValue(of(undefined)),
    };
    boardClientMock = {
      list: vi.fn().mockReturnValue(of({ data: mockBoards })),
      create: vi.fn().mockReturnValue(of({ ...mockBoards[0], id: 'b3', name: 'New Board' })),
    };
    authStoreMock = {
      tenantRole: vi.fn().mockReturnValue('owner'),
    };

    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { en: {} } })],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: 'http://localhost/api' },
        { provide: ProjectClient, useValue: projectClientMock },
        { provide: BoardClient, useValue: boardClientMock },
        { provide: AuthStore, useValue: authStoreMock },
      ],
    });

    const fixture = TestBed.createComponent(ProjectDetail);

    fixture.componentRef.setInput('projectId', mockProject.id);

    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  // ── Loading on init ─────────────────────────────────────────────────────

  describe('ngOnInit', () => {
    beforeEach(() => setup());

    it('should call projectClient.getById with projectId', () => {
      expect(projectClientMock.getById).toHaveBeenCalledWith(mockProject.id);
    });

    it('should populate the project signal', () => {
      expect(component.project()).toEqual(mockProject);
    });

    it('should load boards for the project', () => {
      expect(boardClientMock.list).toHaveBeenCalledWith(mockProject.id);
      expect(component.boards()).toEqual(mockBoards);
    });

    it('should load members for the project', () => {
      expect(projectClientMock.listMembers).toHaveBeenCalledWith(mockProject.id);
      expect(component.members()).toEqual(mockMembers);
    });

    it('should set loading to false', () => {
      expect(component.loading()).toBe(false);
    });
  });

  // ── createBoard ────────────────────────────────────────────────────────

  describe('createBoard', () => {
    beforeEach(() => setup());

    it('should not create board when name is empty', () => {
      component.boardModel.update((m: { name: string; description: string }) => ({ ...m, name: '' }));
      submit(component.createBoardForm);
      expect(boardClientMock.create).not.toHaveBeenCalled();
    });

    it('should create board and add to list', () => {
      component.boardModel.update((m: { name: string; description: string }) => ({ ...m, name: 'New Board' }));
      submit(component.createBoardForm);

      expect(boardClientMock.create).toHaveBeenCalledWith(mockProject.id, { name: 'New Board', description: '' });
      expect(component.boards()).toHaveLength(3);
      expect(component.showCreateBoard()).toBe(false);
    });

    it('should reset newBoard after creation', () => {
      component.boardModel.update((m: { name: string; description: string }) => ({ ...m, name: 'New Board' }));
      submit(component.createBoardForm);

      expect(component.boardModel().name).toBe('');
    });

    it('should set creatingBoard to false on error', () => {
      boardClientMock.create.mockReturnValueOnce(throwError(() => new Error('fail')));
      component.boardModel.update((m: { name: string; description: string }) => ({ ...m, name: 'Fail Board' }));
      submit(component.createBoardForm);

      expect(component.loading()).toBe(false);
    });
  });

  // ── addMember ──────────────────────────────────────────────────────────

  describe('addMember', () => {
    beforeEach(() => setup());

    it('should not add member when userId is empty', () => {
      component.memberModel.update((m: { userId: string; role: string }) => ({ ...m, userId: '' }));
      submit(component.addMemberForm);
      expect(projectClientMock.addMember).not.toHaveBeenCalled();
    });

    it('should call projectClient.addMember with correct params', () => {
      component.memberModel.update((m: { userId: string; role: string }) => ({ ...m, userId: 'user-new' }));
      component.memberModel.update((m: { userId: string; role: string }) => ({ ...m, role: 'developer' }));
      submit(component.addMemberForm);

      expect(projectClientMock.addMember).toHaveBeenCalledWith(mockProject.id, 'user-new', 'developer');
    });

    it('should reset member form after success', () => {
      component.memberModel.update((m: { userId: string; role: string }) => ({ ...m, userId: 'user-new' }));
      submit(component.addMemberForm);

      expect(component.memberModel().userId).toBe('');
      expect(component.memberModel().role).toBe('developer');
      expect(component.showAddMember()).toBe(false);
    });

    it('should set addingMember to false on error', () => {
      projectClientMock.addMember.mockReturnValueOnce(throwError(() => new Error('fail')));
      component.memberModel.update((m: { userId: string; role: string }) => ({ ...m, userId: 'user-new' }));
      submit(component.addMemberForm);

      expect(component.loading()).toBe(false);
    });
  });

  // ── onRoleChange ───────────────────────────────────────────────────────

  describe('onRoleChange', () => {
    beforeEach(() => setup());

    it('should not call API when role is unchanged', () => {
      component.onRoleChange(mockMembers[0], 'admin');
      expect(projectClientMock.updateMemberRole).not.toHaveBeenCalled();
    });

    it('should call projectClient.updateMemberRole when role changes', () => {
      component.onRoleChange(mockMembers[1], 'viewer');
      expect(projectClientMock.updateMemberRole).toHaveBeenCalledWith(mockProject.id, 'u2', 'viewer');
    });
  });

  // ── confirmRemoveMember / removeMember ──────────────────────────────────

  describe('removeMember', () => {
    beforeEach(() => setup());

    it('should set memberToRemove on confirmRemoveMember', () => {
      component.confirmRemoveMember(mockMembers[0]);
      expect(component.memberToRemove()).toEqual(mockMembers[0]);
      expect(component.showRemoveConfirm()).toBe(true);
    });

    it('should remove member and reload members', () => {
      component.confirmRemoveMember(mockMembers[0]);
      component.removeMember();

      expect(projectClientMock.removeMember).toHaveBeenCalledWith(mockProject.id, 'u1');
      expect(component.showRemoveConfirm()).toBe(false);
      expect(component.memberToRemove()).toBeNull();
    });

    it('should set removingMember to false on error', () => {
      projectClientMock.removeMember.mockReturnValueOnce(throwError(() => new Error('fail')));
      component.confirmRemoveMember(mockMembers[0]);
      component.removeMember();

      expect(component.loading()).toBe(false);
    });
  });

  // ── Dialog state changes ───────────────────────────────────────────────

  describe('dialog state changes', () => {
    beforeEach(() => setup());

    it('should close create board dialog on closed state', () => {
      component.showCreateBoard.set(true);
      component.onDialogStateChange('closed');
      expect(component.showCreateBoard()).toBe(false);
    });

    it('should close add member dialog on closed state', () => {
      component.showAddMember.set(true);
      component.onAddMemberDialogStateChange('closed');
      expect(component.showAddMember()).toBe(false);
    });

    it('should close remove confirm dialog and clear memberToRemove', () => {
      component.memberToRemove.set(mockMembers[0]);
      component.showRemoveConfirm.set(true);
      component.onRemoveDialogStateChange('closed');

      expect(component.showRemoveConfirm()).toBe(false);
      expect(component.memberToRemove()).toBeNull();
    });
  });

  // ── isAdmin computed ───────────────────────────────────────────────────

  describe('isAdmin', () => {
    it('should be true when tenantRole is owner', () => {
      setup();
      expect(component.isAdmin()).toBe(true);
    });

    it('should be true when tenantRole is admin', () => {
      authStoreMock = { tenantRole: vi.fn().mockReturnValue('admin') };
      projectClientMock = {
        getById: vi.fn().mockReturnValue(of(mockProject)),
        listMembers: vi.fn().mockReturnValue(of({ data: mockMembers })),
        addMember: vi.fn(),
        updateMemberRole: vi.fn(),
        removeMember: vi.fn(),
      };
      boardClientMock = {
        list: vi.fn().mockReturnValue(of({ data: mockBoards })),
        create: vi.fn(),
      };
      TestBed.configureTestingModule({
        imports: [TranslocoTestingModule.forRoot({ langs: { en: {} } })],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([]),
          { provide: API_BASE_URL, useValue: 'http://localhost/api' },
          { provide: ProjectClient, useValue: projectClientMock },
          { provide: BoardClient, useValue: boardClientMock },
          { provide: AuthStore, useValue: authStoreMock },
        ],
      });

      const fixture = TestBed.createComponent(ProjectDetail);

      fixture.componentRef.setInput('projectId', mockProject.id);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component.isAdmin()).toBe(true);
    });

    it('should be false when tenantRole is member', () => {
      authStoreMock = { tenantRole: vi.fn().mockReturnValue('member') };
      projectClientMock = {
        getById: vi.fn().mockReturnValue(of(mockProject)),
        listMembers: vi.fn().mockReturnValue(of({ data: mockMembers })),
        addMember: vi.fn(),
        updateMemberRole: vi.fn(),
        removeMember: vi.fn(),
      };
      boardClientMock = {
        list: vi.fn().mockReturnValue(of({ data: mockBoards })),
        create: vi.fn(),
      };
      TestBed.configureTestingModule({
        imports: [TranslocoTestingModule.forRoot({ langs: { en: {} } })],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([]),
          { provide: API_BASE_URL, useValue: 'http://localhost/api' },
          { provide: ProjectClient, useValue: projectClientMock },
          { provide: BoardClient, useValue: boardClientMock },
          { provide: AuthStore, useValue: authStoreMock },
        ],
      });

      const fixture = TestBed.createComponent(ProjectDetail);

      fixture.componentRef.setInput('projectId', mockProject.id);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component.isAdmin()).toBe(false);
    });
  });
});
