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
import { TranslocoTestingModule } from '@jsverse/transloco';
import { SprintBacklog } from './sprint-backlog';
import { TaskClient } from '@services/task-client';
import { API_BASE_URL } from '@app/api-url.token';
import type { Task, Sprint } from '@task-board/shared';

const NOW = '2025-01-01T00:00:00Z';
const mockBacklogTasks: Task[] = [
  {
    id: 'tk1',
    projectId: 'p1',
    number: 1,
    typeId: 'type1',
    title: 'Backlog Task 1',
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
  },
  {
    id: 'tk2',
    projectId: 'p1',
    number: 2,
    typeId: 'type1',
    title: 'Backlog Task 2',
    description: null,
    statusId: 's1',
    priority: 'HIGH',
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
  },
];
const mockSprint: Sprint = {
  id: 'sp1',
  projectId: 'p1',
  name: 'Sprint 1',
  startDate: NOW,
  endDate: '2025-02-01T00:00:00Z',
  status: 'FUTURE',
  createdAt: NOW,
  updatedAt: NOW,
};

describe('SprintBacklog', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let component: any;
  let taskClientMock: { list: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };

  function setup(sprint: Sprint | null = mockSprint) {
    taskClientMock = {
      list: vi
        .fn()
        .mockReturnValue(of({ data: mockBacklogTasks, pagination: { total: 2, page: 1, limit: 200, totalPages: 1 } })),
      update: vi.fn().mockImplementation((_id: string, data: Partial<Task>) => of({ ...mockBacklogTasks[0], ...data })),
    };

    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { en: {} } })],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: 'http://localhost/api' },
        { provide: TaskClient, useValue: taskClientMock },
      ],
    });

    const fixture = TestBed.createComponent(SprintBacklog);

    fixture.componentRef.setInput('projectId', 'p1');
    if (sprint) {
      fixture.componentRef.setInput('targetSprint', sprint);
    }

    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  // ── Loading ─────────────────────────────────────────────────────

  describe('ngOnInit', () => {
    beforeEach(() => setup());

    it('should call taskClient.list with projectId and sprintId null', () => {
      expect(taskClientMock.list).toHaveBeenCalledWith('p1', { sprintId: null, limit: 200 });
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
        update: vi.fn(),
      };

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [TranslocoTestingModule.forRoot({ langs: { en: {} } })],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([]),
          { provide: API_BASE_URL, useValue: 'http://localhost/api' },
          { provide: TaskClient, useValue: taskClientMock },
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
      expect(component.getPriorityDot('LOW')).toBe('bg-blue-500');
      expect(component.getPriorityDot('MEDIUM')).toBe('bg-yellow-500');
      expect(component.getPriorityDot('HIGH')).toBe('bg-orange-500');
      expect(component.getPriorityDot('CRITICAL')).toBe('bg-red-500');
      expect(component.getPriorityDot('unknown')).toBe('bg-gray-500');
    });
  });

  // ── addTaskToSprint ────────────────────────────────────────────────────

  describe('addTaskToSprint', () => {
    beforeEach(() => setup());

    it('should call taskClient.update with sprintId', () => {
      const task = mockBacklogTasks[0];

      component.addTaskToSprint(task);

      expect(taskClientMock.update).toHaveBeenCalledWith(task.id, { sprintId: mockSprint.id, version: task.version });
    });

    it('should remove task from backlogTasks after adding to sprint', () => {
      component.addTaskToSprint(mockBacklogTasks[0]);

      expect(component.backlogTasks()).toHaveLength(1);
      expect(component.backlogTasks().find((t: Task) => t.id === 'tk1')).toBeUndefined();
    });

    it('should not call API when targetSprint is null', () => {
      taskClientMock = {
        list: vi
          .fn()
          .mockReturnValue(
            of({ data: mockBacklogTasks, pagination: { total: 2, page: 1, limit: 200, totalPages: 1 } }),
          ),
        update: vi.fn(),
      };

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [TranslocoTestingModule.forRoot({ langs: { en: {} } })],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([]),
          { provide: API_BASE_URL, useValue: 'http://localhost/api' },
          { provide: TaskClient, useValue: taskClientMock },
        ],
      });

      const fixture = TestBed.createComponent(SprintBacklog);

      fixture.componentRef.setInput('projectId', 'p1');
      // Do not set targetSprint — it defaults to null
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.addTaskToSprint(mockBacklogTasks[0]);

      expect(taskClientMock.update).not.toHaveBeenCalled();
    });
  });
});
