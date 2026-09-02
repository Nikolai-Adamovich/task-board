/**
 * Tests for the BoardView component.
 *
 * Covers:
 * - Initial loading state
 * - Board / tasks data fetching on init
 * - tasksByColumnId filtering (S-08 computed map)
 * - goToTask navigation
 * - goToNewTask navigation (U1 — create dialog replaced by tasks/new page)
 */
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router, ActivatedRoute } from '@angular/router';
import { firstValueFrom, of, throwError } from 'rxjs';
import { TranslocoService, TranslocoTestingModule } from '@jsverse/transloco';
import { BoardView } from './board-view';
import { BoardClient } from '@services/board-client';
import { TaskClient } from '@services/task-client';
import { SprintClient } from '@services/sprint-client';
import { StatusClient } from '@services/status-client';
import { ProjectClient } from '@services/project-client';
import { ProjectStore } from '@stores/project-store';
import { AuthStore } from '@stores/auth-store';
import { API_BASE_URL } from '@app/api-url.token';
import type { BoardConfig, Task } from '@task-board/shared';
import { settle } from '@app/shared/testing/zoneless';

// ── Test fixtures ───────────────────────────────────────────

const NOW = new Date().toISOString();
const mockBoard: BoardConfig = {
  projectId: 'p0000000-0000-0000-0000-000000000001',
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
    priorityLevel: 1,
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

function createBoardClientMock(board: BoardConfig = mockBoard) {
  return {
    getForProject: vi.fn().mockReturnValue(of(board)),
  };
}

function createTaskClientMock(tasks: Task[] = mockTasks) {
  return {
    listForBoard: vi
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

  async function setup(
    inputOverrides: Record<string, unknown> = {},
    statuses: { id: string; name: string }[] = [],
    board: BoardConfig = mockBoard,
    tasks: Task[] = mockTasks,
    authUser: { id: string } | null = null,
  ) {
    boardClientMock = createBoardClientMock(board);
    taskClientMock = createTaskClientMock(tasks);
    sprintClientMock = createSprintClientMock();
    routerMock = { navigate: vi.fn().mockResolvedValue(true) };

    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ preloadLangs: true, langs: { en: {} } })],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: 'http://localhost/api' },
        {
          provide: AuthStore,
          useValue: {
            isAuthenticated: () => authUser !== null,
            currentUser: () => authUser,
            token: () => null,
            tenantRole: () => null,
          },
        },
        { provide: BoardClient, useValue: boardClientMock },
        { provide: TaskClient, useValue: taskClientMock },
        { provide: SprintClient, useValue: sprintClientMock },
        { provide: StatusClient, useValue: { list: vi.fn().mockReturnValue(of(statuses)) } },
        { provide: ProjectClient, useValue: { listMembers: vi.fn().mockReturnValue(of([])) } },
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
            members: () => [],
          },
        },
      ],
    });
    await firstValueFrom(TestBed.inject(TranslocoService).load('en'));

    const fixture = TestBed.createComponent(BoardView);

    // Set required input before detectChanges
    fixture.componentRef.setInput('projectKey', 'proj-key');
    Object.entries(inputOverrides).forEach(([key, value]) => {
      fixture.componentRef.setInput(key, value);
    });

    component = fixture.componentInstance;
    await settle(fixture);

    return fixture;
  }

  /** Poll until `cond()` is true (reference data resolves asynchronously via ProjectRefStore) */
  async function until(fx: ComponentFixture<unknown>, cond: () => boolean): Promise<void> {
    for (let i = 0; i < 200 && !cond(); i++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      await settle(fx);
    }
  }

  // ── Loading state ───────────────────────────────────────

  describe('loading state', () => {
    it('should show loading spinner while data is being fetched', async () => {
      boardClientMock = createBoardClientMock();
      taskClientMock = createTaskClientMock();
      sprintClientMock = createSprintClientMock();
      routerMock = { navigate: vi.fn().mockResolvedValue(true) };

      TestBed.configureTestingModule({
        imports: [TranslocoTestingModule.forRoot({ preloadLangs: true, langs: { en: {} } })],
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
              members: () => [],
            },
          },
        ],
      });
      await firstValueFrom(TestBed.inject(TranslocoService).load('en'));

      const fixture = TestBed.createComponent(BoardView);

      // Before detectChanges, loading should be true
      component = fixture.componentInstance;
      expect(component.loading()).toBe(true);
    });

    it('should set loading to false after board loads successfully', async () => {
      await setup();

      expect(component.loading()).toBe(false);
    });

    it('should set loading to false when board fetch fails', async () => {
      boardClientMock = createBoardClientMock();
      boardClientMock.getForProject.mockReturnValue(throwError(() => new Error('Network error')));
      taskClientMock = createTaskClientMock();
      sprintClientMock = createSprintClientMock();
      routerMock = { navigate: vi.fn().mockResolvedValue(true) };

      TestBed.configureTestingModule({
        imports: [TranslocoTestingModule.forRoot({ preloadLangs: true, langs: { en: {} } })],
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
              members: () => [],
            },
          },
        ],
      });
      await firstValueFrom(TestBed.inject(TranslocoService).load('en'));

      const fixture = TestBed.createComponent(BoardView);

      component = fixture.componentInstance;
      await settle(fixture);

      expect(component.loading()).toBe(false);
    });
  });

  // ── Data fetching on init ──────────────────────────────────────

  describe('ngOnInit', () => {
    beforeEach(() => setup());

    it('should call boardClient.getForProject with the active project id', () => {
      expect(boardClientMock.getForProject).toHaveBeenCalledWith('p0000000-0000-0000-0000-000000000001');
    });

    it('should populate the board signal', () => {
      expect(component.board()).toEqual(mockBoard);
    });

    it('should call taskClient.listForBoard with projectId and limit 200', () => {
      expect(taskClientMock.listForBoard).toHaveBeenCalledWith('p0000000-0000-0000-0000-000000000001', { limit: 200 });
    });

    it('should populate tasks signal', () => {
      expect(component.tasks()).toHaveLength(3);
    });
  });

  // ── tasksByColumnId (S-08 computed map, V4-12 ownership) ───────

  describe('tasksByColumnId', () => {
    beforeEach(() => setup());

    it('should return tasks filtered by column statusIds', () => {
      const col = mockBoard.columns[0]; // statusIds: ['s1', 's2']
      const tasks = component.tasksByColumnId().get(col?.id) ?? [];

      expect(tasks.every((t: Task) => col?.statusIds.includes(t.statusId))).toBe(true);
    });

    it('should return tasks sorted by number ascending', () => {
      const col = mockBoard.columns[0];
      const tasks = (component.tasksByColumnId().get(col?.id) ?? []) as Task[];

      expect(tasks[0]?.number).toBeLessThanOrEqual(tasks[1]?.number ?? Number.NaN);
    });

    it('should return empty array when no tasks match the column', () => {
      const col = mockBoard.columns[2]; // statusIds: ['s4']
      const tasks = component.tasksByColumnId().get(col?.id) ?? [];

      expect(tasks).toHaveLength(0);
    });
  });

  // ── goToTask ────────────────────────────────────────────

  describe('goToTask', () => {
    beforeEach(() => setup());

    it('should navigate to the task detail route using the KEY-number format', () => {
      const task = mockTasks[0];

      component.goToTask(task);

      expect(routerMock.navigate).toHaveBeenCalledWith(['/w', 't1', 'projects', 't1', 'tasks', `t1-${task?.number}`]);
    });
  });

  // ── goToNewTask (U1) ────────────────────────────────────

  describe('goToNewTask', () => {
    beforeEach(() => setup());

    it('should navigate to the unified create-task page instead of opening a dialog', () => {
      component.goToNewTask();

      expect(routerMock.navigate).toHaveBeenCalledWith(['/w', 't1', 'projects', 't1', 'tasks', 'new']);
    });
  });

  // ── Sprint selector (DEC-038) ──────────────────────────

  describe('sprint selector', () => {
    beforeEach(() => setup());

    it('should fetch sprints for the board project', () => {
      expect(sprintClientMock.list).toHaveBeenCalledWith('p0000000-0000-0000-0000-000000000001');
      expect(component.sprints()).toEqual(mockSprints);
    });

    it('should scope the task query when sprintId input is set', async () => {
      TestBed.resetTestingModule();
      await setup({ sprintId: 'sp1' });

      expect(taskClientMock.listForBoard).toHaveBeenCalledWith('p0000000-0000-0000-0000-000000000001', {
        limit: 200,
        sprintId: 'sp1',
      });
    });

    it('should resolve the scoped sprint display name from the list', async () => {
      TestBed.resetTestingModule();
      await setup({ sprintId: 'sp1' });

      expect(component.selectedSprintName()).toBe('Sprint 1');
    });

    it('should fall back to the raw id for an unknown sprint', async () => {
      TestBed.resetTestingModule();
      await setup({ sprintId: 'unknown-id' });

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

  // ── Board assignee/priority filters (F-08) ──────────────

  describe('board filters (F-08)', () => {
    it('should resolve ?assignee=me to the current user id at query time', async () => {
      TestBed.resetTestingModule();
      await setup({ assignee: 'me' }, [], mockBoard, mockTasks, { id: 'u1' });

      expect(taskClientMock.listForBoard).toHaveBeenCalledWith('p0000000-0000-0000-0000-000000000001', {
        limit: 200,
        assigneeId: 'u1',
      });
    });

    it('should pass a concrete member id server-side', async () => {
      TestBed.resetTestingModule();
      await setup({ assignee: 'u2' });

      expect(taskClientMock.listForBoard).toHaveBeenCalledWith('p0000000-0000-0000-0000-000000000001', {
        limit: 200,
        assigneeId: 'u2',
      });
    });

    it('should not send assigneeId for ?assignee=unassigned and post-filter client-side', async () => {
      TestBed.resetTestingModule();

      const assigned = makeTask({ id: 'tk-assigned', statusId: 's1', title: 'Assigned', number: 9, assigneeId: 'u2' });

      await setup({ assignee: 'unassigned' }, [], mockBoard, [...mockTasks, assigned]);

      const call = taskClientMock.listForBoard.mock.calls[0]?.[1] as Record<string, unknown>;

      expect(call.assigneeId).toBeUndefined();
      expect(component.filteredTasks().map((t: Task) => t.id)).not.toContain('tk-assigned');
      expect(component.filteredTasks()).toHaveLength(mockTasks.length);
    });

    it('should send the priority filter server-side', async () => {
      TestBed.resetTestingModule();
      await setup({ priorityLevel: 2 });

      expect(taskClientMock.listForBoard).toHaveBeenCalledWith('p0000000-0000-0000-0000-000000000001', {
        limit: 200,
        priorityLevel: 2,
      });
    });

    it('should write ?assignee= to the URL on selection and clear with the empty value', async () => {
      await setup();

      component.onAssigneeSelect('u2');

      expect(routerMock.navigate).toHaveBeenCalledWith(
        [],
        expect.objectContaining({
          queryParams: { assignee: 'u2' },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        }),
      );

      component.onAssigneeSelect('');

      expect(routerMock.navigate).toHaveBeenCalledWith(
        [],
        expect.objectContaining({
          queryParams: { assignee: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        }),
      );
    });

    it('should write ?priorityLevel= to the URL on selection and clear with the empty value', async () => {
      await setup();

      component.onPrioritySelect(2);

      expect(routerMock.navigate).toHaveBeenCalledWith(
        [],
        expect.objectContaining({
          queryParams: { priorityLevel: '2' },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        }),
      );

      component.onPrioritySelect('');

      expect(routerMock.navigate).toHaveBeenCalledWith(
        [],
        expect.objectContaining({
          queryParams: { priorityLevel: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        }),
      );
    });

    it('should fall back to the raw id for the assignee chip label when members are not loaded', async () => {
      TestBed.resetTestingModule();
      await setup({ assignee: 'u2' });

      expect(component.selectedAssigneeLabel()).toBe('u2');
    });

    it('should produce an empty chip label when no assignee filter is set', async () => {
      await setup();

      expect(component.selectedAssigneeLabel()).toBe('');
      expect(component.selectedPriorityLabel()).toBe('');
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
      const fx = await setup({}, namedStatuses);

      // Column names resolve asynchronously once ProjectRefStore has the statuses
      await until(fx, () => fx.nativeElement.textContent.includes('To Do / In Progress'));

      const text = fx.nativeElement.textContent as string;

      expect(text).toContain('To Do / In Progress');
      expect(text).toContain('Done');
      expect(text).toContain('Reopened');
      expect(text).not.toContain('Column 1');
    });

    it('should fall back to a positional label when statuses are not loaded', async () => {
      const fx = await setup({});

      expect(fx.nativeElement.textContent).toContain('Column 1');
    });
  });

  // ── WIP counts in column headers (Q9 / RQ-04 ⑥) ─────────

  describe('WIP counts in column headers (Q9)', () => {
    it('should render a muted count badge with the number of tasks in each column', async () => {
      const fx = await setup({});

      // Wait for the board + tasks to render (mockTasks: 2×s1 → col1, 1×s3 → col2)
      await until(fx, () => !!fx.nativeElement.querySelector('.cdk-drop-list'));

      const counts = Array.from(fx.nativeElement.querySelectorAll('h3 span:last-child')).map((span) =>
        (span as HTMLElement).textContent?.trim(),
      );

      expect(counts).toEqual(['2', '1', '0']);
    });
  });

  // ── Exclusive column assignment (V4-12) ─────────────────

  describe('exclusive column assignment (V4-12)', () => {
    /**
     * Overlapping board like the one observed in V4-12: a combined
     * "In Progress / Reopened" column sits next to a pure "In Progress" column.
     */
    const overlapBoard: BoardConfig = {
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

    async function setupOverlap() {
      return setup({}, [], overlapBoard, overlapTasks);
    }

    it('should show a REOPENED task only in the combined column (never duplicated)', async () => {
      await setupOverlap();

      const reopened = overlapTasks[1];
      const combined = component.board().columns.find((c: { id: string }) => c.id === 'col-combined');
      const others = component.board().columns.filter((c: { id: string }) => c.id !== 'col-combined');

      expect((component.tasksByColumnId().get(combined.id) ?? []).map((t: Task) => t.id)).toContain(reopened?.id);
      for (const other of others) {
        expect((component.tasksByColumnId().get(other.id) ?? []).map((t: Task) => t.id)).not.toContain(reopened?.id);
      }
    });

    it('should show an IN_PROGRESS task only in the dedicated IN_PROGRESS column', async () => {
      await setupOverlap();

      const inProgress = overlapTasks[2];
      const combined = component.board().columns.find((c: { id: string }) => c.id === 'col-combined');
      const pure = component.board().columns.find((c: { id: string }) => c.id === 'col-inprogress');

      // Most-specific (single-status) column wins ownership of the shared status
      expect((component.tasksByColumnId().get(pure.id) ?? []).map((t: Task) => t.id)).toContain(inProgress?.id);
      expect((component.tasksByColumnId().get(combined.id) ?? []).map((t: Task) => t.id)).not.toContain(inProgress?.id);
    });

    it('should render every task in exactly one column (no card duplication)', async () => {
      await setupOverlap();

      const columns = component.board().columns;
      const assignments = overlapTasks.map((task) =>
        columns.filter((c: { id: string }) =>
          (component.tasksByColumnId().get(c.id) ?? []).some((t: Task) => t.id === task.id),
        ),
      );

      for (const cols of assignments) {
        expect(cols).toHaveLength(1);
      }
    });
  });

  // ── Empty columns ───────────────────────────────────────

  describe('empty columns', () => {
    it('should render no placeholder text at all in an empty column', async () => {
      const fx = await setup();
      // col3 (statusIds: ['s4']) has no matching tasks
      const dropList = fx.nativeElement.querySelector('#column-col3');

      expect(dropList).not.toBeNull();
      expect(dropList.querySelector('[data-drop-zone]')).toBeNull();
      expect((dropList.textContent as string).trim()).toBe('');
    });
  });
});
