/**
 * Tests for the SprintBacklog component.
 *
 * Covers:
 * - Loading backlog tasks (tasks with no sprint) on init
 * - Loading/error states
 * - getPriorityDot helper
 * - addTaskToSprint
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { SprintBacklog } from './sprint-backlog';
import { SprintClient } from '@services/sprint-client';
import { TaskClient } from '@services/task-client';
import { API_BASE_URL } from '@app/api-url.token';
import type { Task, Sprint } from '@task-board/shared';

const NOW = '2025-01-01T00:00:00Z';
const mockBacklogTasks: Task[] = [
  {
    id: 'tk1',
    tenantId: 't1',
    projectId: 'p1',
    boardId: 'b1',
    columnId: 'c1',
    sprintId: null,
    title: 'Backlog Task 1',
    description: null,
    assigneeIds: [],
    priority: 'medium',
    position: 0,
    createdBy: 'u1',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'tk2',
    tenantId: 't1',
    projectId: 'p1',
    boardId: 'b1',
    columnId: 'c1',
    sprintId: null,
    title: 'Backlog Task 2',
    description: null,
    assigneeIds: [],
    priority: 'high',
    position: 1,
    createdBy: 'u1',
    createdAt: NOW,
    updatedAt: NOW,
  },
];
const mockSprint: Sprint = {
  id: 'sp1',
  tenantId: 't1',
  projectId: 'p1',
  name: 'Sprint 1',
  startDate: NOW,
  endDate: '2025-02-01T00:00:00Z',
  goal: null,
  status: 'planned',
  taskIds: [],
  createdAt: NOW,
  updatedAt: NOW,
};

describe('SprintBacklog', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let component: any;
  let taskClientMock: { list: ReturnType<typeof vi.fn> };
  let sprintClientMock: { addTask: ReturnType<typeof vi.fn> };

  function setup(sprint: Sprint | null = mockSprint) {
    taskClientMock = {
      list: vi.fn().mockReturnValue(of({ data: mockBacklogTasks, total: 2, page: 1, limit: 200 })),
    };
    sprintClientMock = {
      addTask: vi.fn().mockReturnValue(of({ ...mockSprint, taskIds: ['tk1'] })),
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: 'http://localhost/api' },
        { provide: TaskClient, useValue: taskClientMock },
        { provide: SprintClient, useValue: sprintClientMock },
      ],
    });

    const fixture = TestBed.createComponent(SprintBacklog);

    fixture.componentRef.setInput('projectId', 'p1');
    fixture.componentRef.setInput('boardId', 'b1');
    if (sprint) {
      fixture.componentRef.setInput('targetSprint', sprint);
    }

    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  // ── Loading ─────────────────────────────────────────────────────────────

  describe('ngOnInit', () => {
    beforeEach(() => setup());

    it('should call taskClient.list with projectId and sprintId null', () => {
      expect(taskClientMock.list).toHaveBeenCalledWith({ projectId: 'p1', sprintId: null, limit: 200 });
    });

    it('should populate backlogTasks signal', () => {
      expect(component.backlogTasks()).toEqual(mockBacklogTasks);
    });

    it('should set loading to false', () => {
      expect(component.loading()).toBe(false);
    });

    it('should set loading to false on error', () => {
      taskClientMock = {
        list: vi.fn().mockReturnValue(throwError(() => new Error('fail'))),
      };
      sprintClientMock = { addTask: vi.fn() };

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([]),
          { provide: API_BASE_URL, useValue: 'http://localhost/api' },
          { provide: TaskClient, useValue: taskClientMock },
          { provide: SprintClient, useValue: sprintClientMock },
        ],
      });

      const fixture = TestBed.createComponent(SprintBacklog);

      fixture.componentRef.setInput('projectId', 'p1');
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component.loading()).toBe(false);
    });
  });

  // ── getPriorityDot ─────────────────────────────────────────────────────

  describe('getPriorityDot', () => {
    beforeEach(() => setup());

    it('should return correct dot for each priority', () => {
      expect(component.getPriorityDot('low')).toBe('bg-blue-500');
      expect(component.getPriorityDot('medium')).toBe('bg-yellow-500');
      expect(component.getPriorityDot('high')).toBe('bg-orange-500');
      expect(component.getPriorityDot('critical')).toBe('bg-red-500');
      expect(component.getPriorityDot('unknown')).toBe('bg-gray-500');
    });
  });

  // ── addTaskToSprint ────────────────────────────────────────────────────

  describe('addTaskToSprint', () => {
    beforeEach(() => setup());

    it('should call sprintClient.addTask with sprint and task IDs', () => {
      component.addTaskToSprint('tk1');

      expect(sprintClientMock.addTask).toHaveBeenCalledWith('sp1', 'tk1');
    });

    it('should remove task from backlogTasks after adding to sprint', () => {
      component.addTaskToSprint('tk1');

      expect(component.backlogTasks()).toHaveLength(1);
      expect(component.backlogTasks().find((t: Task) => t.id === 'tk1')).toBeUndefined();
    });

    it('should not call API when targetSprint is null', () => {
      sprintClientMock = { addTask: vi.fn() };
      taskClientMock = { list: vi.fn().mockReturnValue(of({ data: mockBacklogTasks, total: 2, page: 1, limit: 200 })) };

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([]),
          { provide: API_BASE_URL, useValue: 'http://localhost/api' },
          { provide: TaskClient, useValue: taskClientMock },
          { provide: SprintClient, useValue: sprintClientMock },
        ],
      });

      const fixture = TestBed.createComponent(SprintBacklog);

      fixture.componentRef.setInput('projectId', 'p1');
      // Do not set targetSprint — it defaults to null
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.addTaskToSprint('tk1');

      expect(sprintClientMock.addTask).not.toHaveBeenCalled();
    });
  });
});
