/**
 * Tests for the BoardView component.
 *
 * Covers:
 * - Initial loading state
 * - Board / tasks data fetching on init
 * - getTasksForColumn filtering
 * - goToTask navigation
 * - goToNewTask navigation (U1 — create dialog replaced by tasks/new page)
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router, ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { BoardView } from './board-view';
import { BoardClient } from '@services/board-client';
import { TaskClient } from '@services/task-client';
import { SprintClient } from '@services/sprint-client';
import { StatusClient } from '@services/status-client';
import { ProjectStore } from '@stores/project-store';
import { AuthStore } from '@stores/auth-store';
import { API_BASE_URL } from '@app/api-url.token';
import type { Board, Task } from '@task-board/shared';

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
const mockSprints = [
  {
    id: 'sp1',
    projectId: 'p0000000-0000-0000-0000-000000000001',
    name: 'Sprint 1',
    status: 'ACTIVE',
    startDate: NOW,
    endDate: NOW,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'sp2',
    projectId: 'p0000000-0000-0000-0000-000000000001',
    name: 'Sprint 2',
    status: 'FUTURE',
    startDate: NOW,
    endDate: NOW,
    createdAt: NOW,
    updatedAt: NOW,
  },
];

// ── Mock factories ──────────────────────────────────────────

function createBoardClientMock(board: Board = mockBoard) {
  return {
    getById: vi.fn().mockReturnValue(of(board)),
  };
}

function createTaskClientMock(tasks: Task[] = mockTasks) {
  return {
    list: vi
      .fn()
      .mockReturnValue(of({ data: tasks, pagination: { total: tasks.length, page: 1, limit: 200, totalPages: 1 } })),
    create: vi.fn().mockReturnValue(of(makeTask({ id: 'tk000000-0000-0000-0000-000000000099', title: 'New Task' }))),
  };
}

function createSprintClientMock() {
  return {
    list: vi.fn().mockReturnValue(of(mockSprints)),
  };
}

// ── Test suite ──────────────────────────────────────────────

describe('BoardView', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let component: any;
  let boardClientMock: ReturnType<typeof createBoardClientMock>;
  let taskClientMock: ReturnType<typeof createTaskClientMock>;
  let sprintClientMock: ReturnType<typeof createSprintClientMock>;
  let routerMock: { navigate: ReturnType<typeof vi.fn> };

  function setup(
    inputOverrides: Record<string, unknown> = {},
    statuses: { id: string; name: string }[] = [],
    board: Board = mockBoard,
    tasks: Task[] = mockTasks,
  ) {
    boardClientMock = createBoardClientMock(board);
    taskClientMock = createTaskClientMock(tasks);
    sprintClientMock = createSprintClientMock();
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
        { provide: SprintClient, useValue: sprintClientMock },
        { provide: StatusClient, useValue: { list: vi.fn().mockReturnValue(of(statuses)) } },
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

    return fixture;
  }

  /** Poll until `cond()` is true (reference data resolves asynchronously via ProjectRefStore) */
  async function until(fx: { detectChanges(): void }, cond: () => boolean): Promise<void> {
    for (let i = 0; i < 200 && !cond(); i++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      fx.detectChanges();
    }
  }

  // ── Loading state ───────────────────────────────────────

  describe('loading state', () => {
    it('should show loading spinner while data is being fetched', () => {
      boardClientMock = createBoardClientMock();
      taskClientMock = createTaskClientMock();
      sprintClientMock = createSprintClientMock();
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
          { provide: SprintClient, useValue: sprintClientMock },
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
      sprintClientMock = createSprintClientMock();
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
          { provide: SprintClient, useValue: sprintClientMock },
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

    it('should navigate to the task detail route using the KEY-number format', () => {
      const task = mockTasks[0];

      component.goToTask(task);

      expect(routerMock.navigate).toHaveBeenCalledWith(['/t', 't1', 'projects', 't1', 'tasks', `t1-${task.number}`]);
    });
  });

  // ── goToNewTask (U1) ────────────────────────────────────

  describe('goToNewTask', () => {
    beforeEach(() => setup());

    it('should navigate to the unified create-task page instead of opening a dialog', () => {
      component.goToNewTask();

      expect(routerMock.navigate).toHaveBeenCalledWith(['/t', 't1', 'projects', 't1', 'tasks', 'new']);
    });
  });

  // ── Sprint selector (DEC-038) ──────────────────────────

  describe('sprint selector', () => {
    beforeEach(() => setup());

    it('should fetch sprints for the board project', () => {
      expect(sprintClientMock.list).toHaveBeenCalledWith('p0000000-0000-0000-0000-000000000001');
      expect(component.sprints()).toEqual(mockSprints);
    });

    it('should scope the task query when sprintId input is set', () => {
      TestBed.resetTestingModule();
      setup({ sprintId: 'sp1' });

      expect(taskClientMock.list).toHaveBeenCalledWith('p0000000-0000-0000-0000-000000000001', {
        limit: 200,
        sprintId: 'sp1',
      });
    });

    it('should resolve the scoped sprint display name from the list', () => {
      TestBed.resetTestingModule();
      setup({ sprintId: 'sp1' });

      expect(component.selectedSprintName()).toBe('Sprint 1');
    });

    it('should fall back to the raw id for an unknown sprint', () => {
      TestBed.resetTestingModule();
      setup({ sprintId: 'unknown-id' });

      expect(component.selectedSprintName()).toBe('unknown-id');
    });

    it('should write ?sprintId= to the URL (replaceUrl) on selection', () => {
      component.onSprintSelect('sp1');

      expect(routerMock.navigate).toHaveBeenCalledWith(
        [],
        expect.objectContaining({
          queryParams: { sprintId: 'sp1' },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        }),
      );
    });

    it('should clear the sprint param when the empty value is selected', () => {
      component.onSprintSelect('');

      expect(routerMock.navigate).toHaveBeenCalledWith(
        [],
        expect.objectContaining({
          queryParams: { sprintId: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        }),
      );
    });
  });

  // ── Status display names (DR-1 / U5) ────────────────────

  describe('status display names (DR-1)', () => {
    const namedStatuses = [
      { id: 's1', name: 'To Do' },
      { id: 's2', name: 'In Progress' },
      { id: 's3', name: 'Done' },
      { id: 's4', name: 'Reopened' },
    ];

    it('should render human status names (not raw ids) in board column headers', async () => {
      const fx = setup({}, namedStatuses);

      // Column names resolve asynchronously once ProjectRefStore has the statuses
      await until(fx, () => fx.nativeElement.textContent.includes('To Do / In Progress'));

      const text = fx.nativeElement.textContent as string;

      expect(text).toContain('To Do / In Progress');
      expect(text).toContain('Done');
      expect(text).toContain('Reopened');
      expect(text).not.toContain('Column 1');
    });

    it('should fall back to a positional label when statuses are not loaded', () => {
      const fx = setup({});

      expect(fx.nativeElement.textContent).toContain('Column 1');
    });
  });

  // ── Exclusive column assignment (V4-12) ─────────────────

  describe('exclusive column assignment (V4-12)', () => {
    /**
     * Overlapping board like the one observed in V4-12: a combined
     * "In Progress / Reopened" column sits next to a pure "In Progress" column.
     */
    const overlapBoard: Board = {
      ...mockBoard,
      columns: [
        { id: 'col-todo', statusIds: ['s1'], position: 0 }, // To Do
        { id: 'col-combined', statusIds: ['s3', 's4'], position: 1 }, // In Progress / Reopened
        { id: 'col-inprogress', statusIds: ['s3'], position: 2 }, // In Progress
        { id: 'col-done', statusIds: ['s2'], position: 3 }, // Done
      ],
    };
    const overlapTasks: Task[] = [
      makeTask({ id: 'tk-todo', statusId: 's1', title: 'Todo Task', number: 1 }),
      makeTask({ id: 'tk-reopened', statusId: 's4', title: 'Reopened Task', number: 2 }),
      makeTask({ id: 'tk-inprogress', statusId: 's3', title: 'In Progress Task', number: 3 }),
      makeTask({ id: 'tk-done', statusId: 's2', title: 'Done Task', number: 4 }),
    ];

    function setupOverlap(): ReturnType<typeof setup> {
      return setup({}, [], overlapBoard, overlapTasks);
    }

    it('should show a REOPENED task only in the combined column (never duplicated)', () => {
      setupOverlap();

      const reopened = overlapTasks[1];
      const combined = component.board().columns.find((c: { id: string }) => c.id === 'col-combined');
      const others = component.board().columns.filter((c: { id: string }) => c.id !== 'col-combined');

      expect(component.getTasksForColumn(combined).map((t: Task) => t.id)).toContain(reopened.id);
      for (const other of others) {
        expect(component.getTasksForColumn(other).map((t: Task) => t.id)).not.toContain(reopened.id);
      }
    });

    it('should show an IN_PROGRESS task only in the dedicated IN_PROGRESS column', () => {
      setupOverlap();

      const inProgress = overlapTasks[2];
      const combined = component.board().columns.find((c: { id: string }) => c.id === 'col-combined');
      const pure = component.board().columns.find((c: { id: string }) => c.id === 'col-inprogress');

      // Most-specific (single-status) column wins ownership of the shared status
      expect(component.getTasksForColumn(pure).map((t: Task) => t.id)).toContain(inProgress.id);
      expect(component.getTasksForColumn(combined).map((t: Task) => t.id)).not.toContain(inProgress.id);
    });

    it('should render every task in exactly one column (no card duplication)', () => {
      setupOverlap();

      const columns = component.board().columns;
      const assignments = overlapTasks.map((task) =>
        columns.filter((c: { statusIds: string[] }) =>
          component.getTasksForColumn(c).some((t: Task) => t.id === task.id),
        ),
      );

      for (const cols of assignments) {
        expect(cols).toHaveLength(1);
      }
    });
  });

  // ── Empty columns ───────────────────────────────────────

  describe('empty columns', () => {
    it('should render no placeholder text at all in an empty column', () => {
      const fx = setup();
      // col3 (statusIds: ['s4']) has no matching tasks
      const dropList = fx.nativeElement.querySelector('#column-col3');

      expect(dropList).not.toBeNull();
      expect(dropList.querySelector('[data-drop-zone]')).toBeNull();
      expect((dropList.textContent as string).trim()).toBe('');
    });
  });
});
