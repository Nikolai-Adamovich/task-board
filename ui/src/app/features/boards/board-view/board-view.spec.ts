/**
 * Tests for the BoardView component.
 *
 * Covers:
 * - Initial loading state
 * - Board / columns / tasks data fetching on init
 * - getTasksForColumn filtering & sorting
 * - onTaskDrop (move task between columns)
 * - goToTask navigation
 * - createTask validation & submission
 * - onDialogStateChange dialog lifecycle
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { submit } from '@angular/forms/signals';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { BoardView } from './board-view';
import { BoardClient } from '@services/board-client';
import { TaskClient } from '@services/task-client';
import { API_BASE_URL } from '@app/api-url.token';
import type { Board, Column, Task, TaskPriority } from '@task-board/shared';

interface CreateTaskForm {
  title: string;
  description: string;
  priority: TaskPriority;
  columnId: string;
}

// ── Test fixtures ───────────────────────────────────────────

const NOW = new Date().toISOString();
const mockBoard: Board = {
  id: 'b0000000-0000-0000-0000-000000000001',
  tenantId: 't0000000-0000-0000-0000-000000000001',
  projectId: 'p0000000-0000-0000-0000-000000000001',
  name: 'Sprint Board',
  description: 'Main project board',
  createdAt: NOW,
  updatedAt: NOW,
};
const mockColumns: Column[] = [
  {
    id: 'c0000000-0000-0000-0000-000000000001',
    boardId: mockBoard.id,
    tenantId: mockBoard.tenantId,
    name: 'To Do',
    position: 0,
    isDefault: true,
    createdAt: NOW,
  },
  {
    id: 'c0000000-0000-0000-0000-000000000002',
    boardId: mockBoard.id,
    tenantId: mockBoard.tenantId,
    name: 'In Progress',
    position: 1,
    isDefault: false,
    createdAt: NOW,
  },
  {
    id: 'c0000000-0000-0000-0000-000000000003',
    boardId: mockBoard.id,
    tenantId: mockBoard.tenantId,
    name: 'Done',
    position: 2,
    isDefault: false,
    createdAt: NOW,
  },
];

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'tk000000-0000-0000-0000-000000000001',
    tenantId: mockBoard.tenantId,
    projectId: mockBoard.projectId,
    boardId: mockBoard.id,
    columnId: mockColumns[0].id,
    sprintId: null,
    title: 'Test Task',
    description: null,
    assigneeIds: [],
    priority: 'medium',
    position: 0,
    createdBy: 'u0000000-0000-0000-0000-000000000001',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

const mockTasks: Task[] = [
  makeTask({ id: 'tk000000-0000-0000-0000-000000000001', columnId: mockColumns[0].id, title: 'Task A', position: 1 }),
  makeTask({ id: 'tk000000-0000-0000-0000-000000000002', columnId: mockColumns[0].id, title: 'Task B', position: 0 }),
  makeTask({ id: 'tk000000-0000-0000-0000-000000000003', columnId: mockColumns[1].id, title: 'Task C', position: 0 }),
];

// ── Mock factories ──────────────────────────────────────────

function createBoardClientMock() {
  return {
    getById: vi.fn().mockReturnValue(of(mockBoard)),
    listColumns: vi.fn().mockReturnValue(of({ data: mockColumns })),
  };
}

function createTaskClientMock() {
  return {
    list: vi.fn().mockReturnValue(of({ data: mockTasks, total: mockTasks.length, page: 1, limit: 200 })),
    create: vi.fn().mockReturnValue(of(makeTask({ id: 'tk000000-0000-0000-0000-000000000099', title: 'New Task' }))),
    move: vi.fn().mockImplementation((data: { taskId: string; targetColumnId: string }) => {
      const original = mockTasks.find((t) => t.id === data.taskId) ?? mockTasks[0];

      return of({ ...original, columnId: data.targetColumnId });
    }),
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
        { provide: BoardClient, useValue: boardClientMock },
        { provide: TaskClient, useValue: taskClientMock },
        { provide: Router, useValue: routerMock },
      ],
    });

    const fixture = TestBed.createComponent(BoardView);

    // Set required input before detectChanges
    fixture.componentRef.setInput('boardId', 'b0000000-0000-0000-0000-000000000001');
    Object.entries(inputOverrides).forEach(([key, value]) => {
      fixture.componentRef.setInput(key, value);
    });

    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  // ── Loading state ───────────────────────────────────────

  describe('loading state', () => {
    it('should show loading spinner while data is being fetched', () => {
      // Override boardClient to delay so we can observe loading state
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
          { provide: BoardClient, useValue: boardClientMock },
          { provide: TaskClient, useValue: taskClientMock },
          { provide: Router, useValue: routerMock },
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
          { provide: BoardClient, useValue: boardClientMock },
          { provide: TaskClient, useValue: taskClientMock },
          { provide: Router, useValue: routerMock },
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

    it('should call boardClient.listColumns with the boardId', () => {
      expect(boardClientMock.listColumns).toHaveBeenCalledWith('b0000000-0000-0000-0000-000000000001');
    });

    it('should populate columns signal sorted by position', () => {
      const cols = component.columns() as Column[];

      expect(cols).toHaveLength(3);
      expect(cols[0].name).toBe('To Do');
      expect(cols[1].name).toBe('In Progress');
      expect(cols[2].name).toBe('Done');
    });

    it('should call taskClient.list with boardId and limit 200', () => {
      expect(taskClientMock.list).toHaveBeenCalledWith({ boardId: 'b0000000-0000-0000-0000-000000000001', limit: 200 });
    });

    it('should populate tasks signal', () => {
      expect(component.tasks()).toHaveLength(3);
    });

    it('should initialize model title with empty string', () => {
      expect(component.model().title).toBe('');
    });

    it('should initialize model priority to Medium', () => {
      expect(component.model().priority).toBe('medium');
    });

    it('should set default model columnId to first column', () => {
      expect(component.model().columnId).toBe(mockColumns[0].id);
    });
  });

  // ── getTasksForColumn ──────────────────────────────────────────

  describe('getTasksForColumn', () => {
    beforeEach(() => setup());

    it('should return tasks filtered by column id', () => {
      const tasks = component.getTasksForColumn(mockColumns[0].id);

      expect(tasks.every((t: Task) => t.columnId === mockColumns[0].id)).toBe(true);
    });

    it('should return tasks sorted by position ascending', () => {
      const tasks = component.getTasksForColumn(mockColumns[0].id) as Task[];

      expect(tasks[0].position).toBeLessThanOrEqual(tasks[1].position);
    });

    it('should return empty array when no tasks match the column', () => {
      const tasks = component.getTasksForColumn(mockColumns[2].id);

      expect(tasks).toHaveLength(0);
    });
  });

  // ── onTaskDrop ──────────────────────────────────────────

  describe('onTaskDrop', () => {
    beforeEach(() => setup());

    it('should call taskClient.move with correct payload', () => {
      const task = mockTasks[0];

      component.onTaskDrop({ task, targetColumnId: mockColumns[1].id });

      expect(taskClientMock.move).toHaveBeenCalledWith({
        taskId: task.id,
        targetColumnId: mockColumns[1].id,
      });
    });

    it('should update the moved task in the tasks signal', () => {
      const task = mockTasks[0];

      component.onTaskDrop({ task, targetColumnId: mockColumns[1].id });

      const updated = component.tasks().find((t: Task) => t.id === task.id) as Task;

      expect(updated.columnId).toBe(mockColumns[1].id);
    });

    it('should not call move when dropping on the same column', () => {
      const task = mockTasks[0];

      component.onTaskDrop({ task, targetColumnId: task.columnId });

      expect(taskClientMock.move).not.toHaveBeenCalled();
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
        task.tenantId,
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
      component.model.update((m: CreateTaskForm) => ({ ...m, columnId: mockColumns[0].id }));
      submit(component.newTaskForm);

      expect(taskClientMock.create).not.toHaveBeenCalled();
    });

    it('should not call taskClient.create when columnId is empty', () => {
      component.model.update((m: CreateTaskForm) => ({ ...m, title: 'Some title' }));
      component.model.update((m: CreateTaskForm) => ({ ...m, columnId: '' }));
      submit(component.newTaskForm);

      expect(taskClientMock.create).not.toHaveBeenCalled();
    });

    it('should call taskClient.create with the model data', () => {
      component.model.update((m: CreateTaskForm) => ({ ...m, title: 'New Task' }));
      component.model.update((m: CreateTaskForm) => ({ ...m, columnId: mockColumns[0].id }));
      component.model.update((m: CreateTaskForm) => ({ ...m, description: 'A description' }));
      component.model.update((m: CreateTaskForm) => ({ ...m, priority: 'high' }));
      submit(component.newTaskForm);

      expect(taskClientMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Task',
          columnId: mockColumns[0].id,
          description: 'A description',
          priority: 'high',
        }),
      );
    });

    it('should add the created task to the tasks signal', () => {
      component.model.update((m: CreateTaskForm) => ({ ...m, title: 'New Task' }));
      component.model.update((m: CreateTaskForm) => ({ ...m, columnId: mockColumns[0].id }));
      submit(component.newTaskForm);

      const tasks = component.tasks() as Task[];

      expect(tasks.some((t) => t.id === 'tk000000-0000-0000-0000-000000000099')).toBe(true);
    });

    it('should close the dialog after successful creation', () => {
      component.showCreateTask.set(true);
      component.model.update((m: CreateTaskForm) => ({ ...m, title: 'New Task' }));
      component.model.update((m: CreateTaskForm) => ({ ...m, columnId: mockColumns[0].id }));
      submit(component.newTaskForm);

      expect(component.showCreateTask()).toBe(false);
    });

    it('should reset model title after successful creation', () => {
      component.model.update((m: CreateTaskForm) => ({ ...m, title: 'New Task' }));
      component.model.update((m: CreateTaskForm) => ({ ...m, columnId: mockColumns[0].id }));
      submit(component.newTaskForm);

      expect(component.model().title).toBe('');
    });

    it('should not close dialog on error', () => {
      taskClientMock.create.mockReturnValueOnce(throwError(() => new Error('fail')));
      component.showCreateTask.set(true);
      component.model.update((m: CreateTaskForm) => ({ ...m, title: 'New Task' }));
      component.model.update((m: CreateTaskForm) => ({ ...m, columnId: mockColumns[0].id }));
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
