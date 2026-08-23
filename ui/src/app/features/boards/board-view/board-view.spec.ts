/**
 * Tests for the BoardView component.
 *
 * Covers:
 * - Initial loading state
 * - Board / tasks data fetching on init
 * - getTasksForColumn filtering
 * - goToTask navigation
 * - createTask validation & submission
 * - onDialogStateChange dialog lifecycle
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router, ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import { submit } from '@angular/forms/signals';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { BoardView } from './board-view';
import { BoardClient } from '@services/board-client';
import { TaskClient } from '@services/task-client';
import { StatusClient } from '@services/status-client';
import { ProjectStore } from '@stores/project-store';
import { AuthStore } from '@stores/auth-store';
import { API_BASE_URL } from '@app/api-url.token';
import type { Board, Task, TaskPriority } from '@task-board/shared';

interface CreateTaskForm {
  title: string;
  description: string;
  priority: TaskPriority;
  statusId: string;
  typeId: string;
}

// ── Test fixtures ───────────────────────────────────────────

const NOW = new Date().toISOString();
const mockBoard: Board = {
  id: 'b0000000-0000-0000-0000-000000000001',
  projectId: 'p0000000-0000-0000-0000-000000000001',
  name: 'Sprint Board',
  type: 'KANBAN',
  columns: [
    { id: 'col1', statusIds: ['s1', 's2'], position: 0 },
    { id: 'col2', statusIds: ['s3'], position: 1 },
    { id: 'col3', statusIds: ['s4'], position: 2 },
  ],
  createdAt: NOW,
  updatedAt: NOW,
};

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'tk000000-0000-0000-0000-000000000001',
    projectId: mockBoard.projectId,
    number: 1,
    typeId: 'type1',
    title: 'Test Task',
    description: null,
    statusId: 's1',
    priority: 'MEDIUM',
    reporterId: null,
    reporterSnapshot: null,
    assigneeId: null,
    assigneeSnapshot: null,
    sprintId: null,
    labelIds: [],
    createdById: 'u1',
    createdBySnapshot: { displayName: 'Test User' },
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

const mockTasks: Task[] = [
  makeTask({ id: 'tk000000-0000-0000-0000-000000000001', statusId: 's1', title: 'Task A', number: 1 }),
  makeTask({ id: 'tk000000-0000-0000-0000-000000000002', statusId: 's1', title: 'Task B', number: 2 }),
  makeTask({ id: 'tk000000-0000-0000-0000-000000000003', statusId: 's3', title: 'Task C', number: 3 }),
];

// ── Mock factories ──────────────────────────────────────────

function createBoardClientMock() {
  return {
    getById: vi.fn().mockReturnValue(of(mockBoard)),
  };
}

function createTaskClientMock() {
  return {
    list: vi
      .fn()
      .mockReturnValue(of({ data: mockTasks, pagination: { total: 3, page: 1, limit: 200, totalPages: 1 } })),
    create: vi.fn().mockReturnValue(of(makeTask({ id: 'tk000000-0000-0000-0000-000000000099', title: 'New Task' }))),
  };
}

// ── Test suite ──────────────────────────────────────────────

describe('BoardView', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let component: any;
  let boardClientMock: ReturnType<typeof createBoardClientMock>;
  let taskClientMock: ReturnType<typeof createTaskClientMock>;
  let routerMock: { navigate: ReturnType<typeof vi.fn> };

  function setup(inputOverrides: Record<string, unknown> = {}) {
    boardClientMock = createBoardClientMock();
    taskClientMock = createTaskClientMock();
    routerMock = { navigate: vi.fn().mockResolvedValue(true) };

    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { en: {} } })],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: 'http://localhost/api' },
        {
          provide: AuthStore,
          useValue: {
            isAuthenticated: () => false,
            currentUser: () => null,
            token: () => null,
            tenantRole: () => null,
          },
        },
        { provide: BoardClient, useValue: boardClientMock },
        { provide: TaskClient, useValue: taskClientMock },
        { provide: StatusClient, useValue: { list: vi.fn().mockReturnValue(of([])) } },
        { provide: Router, useValue: routerMock },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: of({}),
            snapshot: { paramMap: { get: () => 't1' } },
            parent: { queryParams: of({}), snapshot: { paramMap: { get: () => 't1' } }, parent: null },
          },
        },
        {
          provide: ProjectStore,
          useValue: { activeProject: () => ({ id: 'p0000000-0000-0000-0000-000000000001' }), projectRole: () => null },
        },
      ],
    });

    const fixture = TestBed.createComponent(BoardView);

    // Set required input before detectChanges
    fixture.componentRef.setInput('boardId', 'b0000000-0000-0000-0000-000000000001');
    fixture.componentRef.setInput('projectKey', 'proj-key');
    Object.entries(inputOverrides).forEach(([key, value]) => {
      fixture.componentRef.setInput(key, value);
    });

    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  // ── Loading state ───────────────────────────────────────

  describe('loading state', () => {
    it('should show loading spinner while data is being fetched', () => {
      boardClientMock = createBoardClientMock();
      taskClientMock = createTaskClientMock();
      routerMock = { navigate: vi.fn().mockResolvedValue(true) };

      TestBed.configureTestingModule({
        imports: [TranslocoTestingModule.forRoot({ langs: { en: {} } })],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([]),
          { provide: API_BASE_URL, useValue: 'http://localhost/api' },
          {
            provide: AuthStore,
            useValue: {
              isAuthenticated: () => false,
              currentUser: () => null,
              token: () => null,
              tenantRole: () => null,
            },
          },
          { provide: BoardClient, useValue: boardClientMock },
          { provide: TaskClient, useValue: taskClientMock },
          { provide: StatusClient, useValue: { list: vi.fn().mockReturnValue(of([])) } },
          { provide: Router, useValue: routerMock },
          {
            provide: ActivatedRoute,
            useValue: {
              queryParams: of({}),
              snapshot: { paramMap: { get: () => 't1' } },
              parent: { queryParams: of({}), snapshot: { paramMap: { get: () => 't1' } }, parent: null },
            },
          },
          {
            provide: ProjectStore,
            useValue: {
              activeProject: () => ({ id: 'p0000000-0000-0000-0000-000000000001' }),
              projectRole: () => null,
            },
          },
        ],
      });

      const fixture = TestBed.createComponent(BoardView);

      fixture.componentRef.setInput('boardId', 'b0000000-0000-0000-0000-000000000001');

      // Before detectChanges, loading should be true
      component = fixture.componentInstance;
      expect(component.loading()).toBe(true);
    });

    it('should set loading to false after board loads successfully', () => {
      setup();

      expect(component.loading()).toBe(false);
    });

    it('should set loading to false when board fetch fails', () => {
      boardClientMock = createBoardClientMock();
      boardClientMock.getById.mockReturnValue(throwError(() => new Error('Network error')));
      taskClientMock = createTaskClientMock();
      routerMock = { navigate: vi.fn().mockResolvedValue(true) };

      TestBed.configureTestingModule({
        imports: [TranslocoTestingModule.forRoot({ langs: { en: {} } })],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([]),
          { provide: API_BASE_URL, useValue: 'http://localhost/api' },
          {
            provide: AuthStore,
            useValue: {
              isAuthenticated: () => false,
              currentUser: () => null,
              token: () => null,
              tenantRole: () => null,
            },
          },
          { provide: BoardClient, useValue: boardClientMock },
          { provide: TaskClient, useValue: taskClientMock },
          { provide: StatusClient, useValue: { list: vi.fn().mockReturnValue(of([])) } },
          { provide: Router, useValue: routerMock },
          {
            provide: ActivatedRoute,
            useValue: {
              queryParams: of({}),
              snapshot: { paramMap: { get: () => 't1' } },
              parent: { queryParams: of({}), snapshot: { paramMap: { get: () => 't1' } }, parent: null },
            },
          },
          {
            provide: ProjectStore,
            useValue: {
              activeProject: () => ({ id: 'p0000000-0000-0000-0000-000000000001' }),
              projectRole: () => null,
            },
          },
        ],
      });

      const fixture = TestBed.createComponent(BoardView);

      fixture.componentRef.setInput('boardId', 'b0000000-0000-0000-0000-000000000001');
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component.loading()).toBe(false);
    });
  });

  // ── Data fetching on init ──────────────────────────────────────

  describe('ngOnInit', () => {
    beforeEach(() => setup());

    it('should call boardClient.getById with the boardId input', () => {
      expect(boardClientMock.getById).toHaveBeenCalledWith('b0000000-0000-0000-0000-000000000001');
    });

    it('should populate the board signal', () => {
      expect(component.board()).toEqual(mockBoard);
    });

    it('should call taskClient.list with projectId and limit 200', () => {
      expect(taskClientMock.list).toHaveBeenCalledWith('p0000000-0000-0000-0000-000000000001', { limit: 200 });
    });

    it('should populate tasks signal', () => {
      expect(component.tasks()).toHaveLength(3);
    });

    it('should initialize model title with empty string', () => {
      expect(component.model().title).toBe('');
    });

    it('should initialize model priority to MEDIUM', () => {
      expect(component.model().priority).toBe('MEDIUM');
    });
  });

  // ── getTasksForColumn ──────────────────────────────────────────

  describe('getTasksForColumn', () => {
    beforeEach(() => setup());

    it('should return tasks filtered by column statusIds', () => {
      const col = mockBoard.columns[0]; // statusIds: ['s1', 's2']
      const tasks = component.getTasksForColumn(col);

      expect(tasks.every((t: Task) => col.statusIds.includes(t.statusId))).toBe(true);
    });

    it('should return tasks sorted by number ascending', () => {
      const col = mockBoard.columns[0];
      const tasks = component.getTasksForColumn(col) as Task[];

      expect(tasks[0].number).toBeLessThanOrEqual(tasks[1].number);
    });

    it('should return empty array when no tasks match the column', () => {
      const col = mockBoard.columns[2]; // statusIds: ['s4']
      const tasks = component.getTasksForColumn(col);

      expect(tasks).toHaveLength(0);
    });
  });

  // ── goToTask ────────────────────────────────────────────

  describe('goToTask', () => {
    beforeEach(() => setup());

    it('should navigate to the task detail route', () => {
      const task = mockTasks[0];

      component.goToTask(task);

      expect(routerMock.navigate).toHaveBeenCalledWith([
        '/tenants',
        't1',
        'projects',
        task.projectId,
        'tasks',
        task.id,
      ]);
    });
  });

  // ── createTask ──────────────────────────────────────────

  describe('createTask', () => {
    beforeEach(() => setup());

    it('should not call taskClient.create when title is empty', () => {
      component.model.update((m: CreateTaskForm) => ({ ...m, title: '' }));
      submit(component.newTaskForm);

      expect(taskClientMock.create).not.toHaveBeenCalled();
    });

    it('should call taskClient.create with the model data', () => {
      component.model.update((m: CreateTaskForm) => ({ ...m, title: 'New Task', statusId: 's1', typeId: 'type1' }));
      component.model.update((m: CreateTaskForm) => ({ ...m, description: 'A description' }));
      component.model.update((m: CreateTaskForm) => ({ ...m, priority: 'HIGH' }));
      submit(component.newTaskForm);

      expect(taskClientMock.create).toHaveBeenCalledWith(
        'p0000000-0000-0000-0000-000000000001',
        expect.objectContaining({
          title: 'New Task',
          description: 'A description',
          priority: 'HIGH',
          statusId: 's1',
          typeId: 'type1',
        }),
      );
    });

    it('should add the created task to the tasks signal', () => {
      component.model.update((m: CreateTaskForm) => ({ ...m, title: 'New Task', statusId: 's1', typeId: 'type1' }));
      submit(component.newTaskForm);

      const tasks = component.tasks() as Task[];

      expect(tasks.some((t) => t.id === 'tk000000-0000-0000-0000-000000000099')).toBe(true);
    });

    it('should close the dialog after successful creation', () => {
      component.showCreateTask.set(true);
      component.model.update((m: CreateTaskForm) => ({ ...m, title: 'New Task', statusId: 's1', typeId: 'type1' }));
      submit(component.newTaskForm);

      expect(component.showCreateTask()).toBe(false);
    });

    it('should reset model title after successful creation', () => {
      component.model.update((m: CreateTaskForm) => ({ ...m, title: 'New Task', statusId: 's1', typeId: 'type1' }));
      submit(component.newTaskForm);

      expect(component.model().title).toBe('');
    });

    it('should not close dialog on error', () => {
      taskClientMock.create.mockReturnValueOnce(throwError(() => new Error('fail')));
      component.showCreateTask.set(true);
      component.model.update((m: CreateTaskForm) => ({ ...m, title: 'New Task', statusId: 's1', typeId: 'type1' }));
      submit(component.newTaskForm);

      expect(component.showCreateTask()).toBe(true);
    });
  });

  // ── onDialogStateChange ────────────────────────────────

  describe('onDialogStateChange', () => {
    beforeEach(() => setup());

    it('should set showCreateTask to false when dialog state is closed', () => {
      component.showCreateTask.set(true);
      component.onDialogStateChange('closed');

      expect(component.showCreateTask()).toBe(false);
    });

    it('should not change showCreateTask when dialog state is open', () => {
      component.showCreateTask.set(true);
      component.onDialogStateChange('open');

      expect(component.showCreateTask()).toBe(true);
    });
  });
});
