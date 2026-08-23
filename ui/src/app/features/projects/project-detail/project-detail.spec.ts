/**
 * Tests for the ProjectDetail component.
 *
 * Covers:
 * - Loading project and boards on init
 * - createBoard validation & submission (v5 shape with type)
 * - Dialog state changes
 * - isAdmin computed signal
 * - Lifecycle actions (archive/restore/delete/cancelDeletion)
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
import { ProjectStore } from '@stores/project-store';
import { API_BASE_URL } from '@app/api-url.token';
import type { Project, Board } from '@task-board/shared';

const NOW = '2025-01-01T00:00:00Z';
const mockProject: Project = {
  id: 'p0000000-0000-0000-0000-000000000001',
  tenantId: 't0000000-0000-0000-0000-000000000001',
  key: 'TP',
  name: 'Test Project',
  description: 'A project for testing',
  status: 'ACTIVE',
  defaultStatusId: 's1',
  defaultBoardId: 'b1',
  archiveReason: null,
  deletionScheduledAt: null,
  createdAt: NOW,
  updatedAt: NOW,
};
const mockBoards: Board[] = [
  {
    id: 'b1',
    projectId: mockProject.id,
    name: 'Board 1',
    type: 'KANBAN',
    columns: [],
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'b2',
    projectId: mockProject.id,
    name: 'Board 2',
    type: 'SPRINT',
    columns: [],
    createdAt: NOW,
    updatedAt: NOW,
  },
];

describe('ProjectDetail', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let component: any;
  let projectClientMock: {
    getById: ReturnType<typeof vi.fn>;
    archive: ReturnType<typeof vi.fn>;
    restore: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    cancelDeletion: ReturnType<typeof vi.fn>;
  };
  let boardClientMock: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  let authStoreMock: {
    tenantRole: ReturnType<typeof vi.fn>;
    isAuthenticated: () => boolean;
    currentUser: () => null;
    token: () => null;
  };

  function setup() {
    projectClientMock = {
      getById: vi.fn().mockReturnValue(of(mockProject)),
      archive: vi.fn().mockReturnValue(of({ success: true })),
      restore: vi.fn().mockReturnValue(of({ success: true })),
      delete: vi.fn().mockReturnValue(of({ success: true })),
      cancelDeletion: vi.fn().mockReturnValue(of({ success: true })),
    };
    boardClientMock = {
      list: vi.fn().mockReturnValue(of(mockBoards)),
      create: vi.fn().mockReturnValue(of({ ...mockBoards[0], id: 'b3', name: 'New Board' })),
    };
    authStoreMock = {
      tenantRole: vi.fn().mockReturnValue('OWNER'),
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
        { provide: ProjectClient, useValue: projectClientMock },
        { provide: BoardClient, useValue: boardClientMock },
        { provide: AuthStore, useValue: authStoreMock },
        { provide: ProjectStore, useValue: { activeProject: () => ({ id: mockProject.id }), projectRole: () => null } },
      ],
    });

    const fixture = TestBed.createComponent(ProjectDetail);

    fixture.componentRef.setInput('projectKey', mockProject.key);

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

    it('should set loading to false', () => {
      expect(component.loading()).toBe(false);
    });
  });

  // ── createBoard ────────────────────────────────────────────────────────

  describe('createBoard', () => {
    beforeEach(() => setup());

    it('should not create board when name is empty', () => {
      component.boardModel.update((m: { name: string; type: string }) => ({ ...m, name: '' }));
      submit(component.createBoardForm);
      expect(boardClientMock.create).not.toHaveBeenCalled();
    });

    it('should create board with v5 shape and add to list', () => {
      component.boardModel.update((m: { name: string; type: string }) => ({ ...m, name: 'New Board' }));
      submit(component.createBoardForm);

      expect(boardClientMock.create).toHaveBeenCalledWith(mockProject.id, {
        name: 'New Board',
        type: 'KANBAN',
        columns: [
          { statusIds: [], position: 0 },
          { statusIds: [], position: 1 },
          { statusIds: [], position: 2 },
        ],
      });
      expect(component.boards()).toHaveLength(3);
      expect(component.showCreateBoard()).toBe(false);
    });

    it('should reset newBoard after creation', () => {
      component.boardModel.update((m: { name: string; type: string }) => ({ ...m, name: 'New Board' }));
      submit(component.createBoardForm);

      expect(component.boardModel().name).toBe('');
    });

    it('should set creatingBoard to false on error', () => {
      boardClientMock.create.mockReturnValueOnce(throwError(() => new Error('fail')));
      component.boardModel.update((m: { name: string; type: string }) => ({ ...m, name: 'Fail Board' }));
      submit(component.createBoardForm);

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
  });

  // ── isAdmin computed ───────────────────────────────────────────────────

  describe('isAdmin', () => {
    it('should be true when tenantRole is owner', () => {
      setup();
      expect(component.isAdmin()).toBe(true);
    });

    it('should be true when tenantRole is ADMIN', () => {
      authStoreMock = {
        tenantRole: vi.fn().mockReturnValue('ADMIN'),
        isAuthenticated: () => false,
        currentUser: () => null,
        token: () => null,
      };
      projectClientMock = {
        getById: vi.fn().mockReturnValue(of(mockProject)),
        archive: vi.fn(),
        restore: vi.fn(),
        delete: vi.fn(),
        cancelDeletion: vi.fn(),
      };
      boardClientMock = {
        list: vi.fn().mockReturnValue(of(mockBoards)),
        create: vi.fn(),
      };
      TestBed.resetTestingModule();
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
          {
            provide: ProjectStore,
            useValue: { activeProject: () => ({ id: mockProject.id }), projectRole: () => null },
          },
        ],
      });

      const fixture = TestBed.createComponent(ProjectDetail);

      fixture.componentRef.setInput('projectKey', mockProject.key);

      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component.isAdmin()).toBe(true);
    });

    it('should be false when tenantRole is MEMBER', () => {
      authStoreMock = {
        tenantRole: vi.fn().mockReturnValue('MEMBER'),
        isAuthenticated: () => false,
        currentUser: () => null,
        token: () => null,
      };
      projectClientMock = {
        getById: vi.fn().mockReturnValue(of(mockProject)),
        archive: vi.fn(),
        restore: vi.fn(),
        delete: vi.fn(),
        cancelDeletion: vi.fn(),
      };
      boardClientMock = {
        list: vi.fn().mockReturnValue(of(mockBoards)),
        create: vi.fn(),
      };

      TestBed.resetTestingModule();
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
          {
            provide: ProjectStore,
            useValue: { activeProject: () => ({ id: mockProject.id }), projectRole: () => null },
          },
        ],
      });

      const fixture = TestBed.createComponent(ProjectDetail);

      fixture.componentRef.setInput('projectKey', mockProject.key);

      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component.isAdmin()).toBe(false);
    });
  });

  // ── Project Lifecycle ──────────────────────────────────────────────────

  describe('project lifecycle', () => {
    beforeEach(() => setup());

    it('should archive project', () => {
      component.archiveProject();
      expect(projectClientMock.archive).toHaveBeenCalledWith(mockProject.id);
      expect(component.project()?.status).toBe('ARCHIVED');
    });

    it('should restore project', () => {
      component.restoreProject();
      expect(projectClientMock.restore).toHaveBeenCalledWith(mockProject.id);
      expect(component.project()?.status).toBe('ACTIVE');
    });

    it('should delete project', () => {
      component.deleteProject();
      expect(projectClientMock.delete).toHaveBeenCalledWith(mockProject.id);
      expect(component.project()?.status).toBe('DELETION_PENDING');
    });

    it('should cancel deletion', () => {
      component.cancelDeletion();
      expect(projectClientMock.cancelDeletion).toHaveBeenCalledWith(mockProject.id);
      expect(component.project()?.status).toBe('ACTIVE');
    });
  });
});
