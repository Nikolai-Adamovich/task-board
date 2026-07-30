/**
 * Tests for the SprintDetail component.
 *
 * Covers:
 * - Loading sprint and tasks on init
 * - Loading/error states
 * - getStatusColor, getPriorityDot, getPriorityBadge helpers
 * - removeTaskFromSprint
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { SprintDetail } from './sprint-detail';
import { SprintClient } from '@services/sprint-client';
import { TaskClient } from '@services/task-client';
import { AuthStore } from '@stores/auth-store';
import { API_BASE_URL } from '@app/api-url.token';
import type { Sprint, Task, User } from '@task-board/shared';

const NOW = '2025-01-01T00:00:00Z';
const mockSprint: Sprint = {
  id: 'sp000000-0000-0000-0000-000000000001',
  tenantId: 't0000000-0000-0000-0000-000000000001',
  projectId: 'p0000000-0000-0000-0000-000000000001',
  name: 'Sprint 1',
  startDate: NOW,
  endDate: '2025-02-01T00:00:00Z',
  goal: 'Ship MVP',
  status: 'active',
  taskIds: ['tk1', 'tk2'],
  createdAt: NOW,
  updatedAt: NOW,
};
const mockSprintTasks: Task[] = [
  {
    id: 'tk1',
    tenantId: mockSprint.tenantId,
    projectId: mockSprint.projectId,
    boardId: 'b1',
    columnId: 'c1',
    sprintId: mockSprint.id,
    title: 'Task 1',
    description: null,
    assigneeIds: [],
    priority: 'high',
    position: 0,
    createdBy: 'u1',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'tk2',
    tenantId: mockSprint.tenantId,
    projectId: mockSprint.projectId,
    boardId: 'b1',
    columnId: 'c1',
    sprintId: mockSprint.id,
    title: 'Task 2',
    description: null,
    assigneeIds: [],
    priority: 'low',
    position: 1,
    createdBy: 'u1',
    createdAt: NOW,
    updatedAt: NOW,
  },
];

describe('SprintDetail', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let component: any;
  let sprintClientMock: {
    getById: ReturnType<typeof vi.fn>;
    removeTask: ReturnType<typeof vi.fn>;
  };
  let taskClientMock: { list: ReturnType<typeof vi.fn> };
  let authStoreMock: { currentUser: ReturnType<typeof vi.fn> };

  function setup(sprintOverrides: Partial<Sprint> = {}) {
    const sprint = { ...mockSprint, ...sprintOverrides };

    sprintClientMock = {
      getById: vi.fn().mockReturnValue(of(sprint)),
      removeTask: vi.fn().mockReturnValue(of({ ...sprint, taskIds: sprint.taskIds.filter((id) => id !== 'tk1') })),
    };
    taskClientMock = {
      list: vi.fn().mockReturnValue(of({ data: mockSprintTasks, total: 2, page: 1, limit: 200 })),
    };
    authStoreMock = {
      currentUser: vi.fn().mockReturnValue({ id: 'u1' } as User),
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: 'http://localhost/api' },
        { provide: SprintClient, useValue: sprintClientMock },
        { provide: TaskClient, useValue: taskClientMock },
        { provide: AuthStore, useValue: authStoreMock },
      ],
    });

    const fixture = TestBed.createComponent(SprintDetail);

    fixture.componentRef.setInput('sprintId', mockSprint.id);

    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  // ── Loading ─────────────────────────────────────────────────────────────

  describe('ngOnInit', () => {
    beforeEach(() => setup());

    it('should call sprintClient.getById on init', () => {
      expect(sprintClientMock.getById).toHaveBeenCalledWith(mockSprint.id);
    });

    it('should populate the sprint signal', () => {
      expect(component.sprint()).toBeTruthy();
      expect(component.sprint().name).toBe('Sprint 1');
    });

    it('should load sprint tasks when sprint has taskIds', () => {
      expect(taskClientMock.list).toHaveBeenCalledWith({ sprintId: mockSprint.id, limit: 200 });
      expect(component.sprintTasks()).toHaveLength(2);
    });

    it('should not load tasks when sprint has empty taskIds', () => {
      // Re-setup with empty taskIds
      sprintClientMock = {
        getById: vi.fn().mockReturnValue(of({ ...mockSprint, taskIds: [] })),
        removeTask: vi.fn(),
      };
      taskClientMock = { list: vi.fn() };
      authStoreMock = { currentUser: vi.fn().mockReturnValue({ id: 'u1' } as User) };

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([]),
          { provide: API_BASE_URL, useValue: 'http://localhost/api' },
          { provide: SprintClient, useValue: sprintClientMock },
          { provide: TaskClient, useValue: taskClientMock },
          { provide: AuthStore, useValue: authStoreMock },
        ],
      });

      const fixture = TestBed.createComponent(SprintDetail);

      fixture.componentRef.setInput('sprintId', mockSprint.id);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(taskClientMock.list).not.toHaveBeenCalled();
    });

    it('should set loading to false', () => {
      expect(component.loading()).toBe(false);
    });

    it('should set loading to false on error', () => {
      sprintClientMock = {
        getById: vi.fn().mockReturnValue(throwError(() => new Error('fail'))),
        removeTask: vi.fn(),
      };
      taskClientMock = { list: vi.fn() };
      authStoreMock = { currentUser: vi.fn().mockReturnValue(null) };

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([]),
          { provide: API_BASE_URL, useValue: 'http://localhost/api' },
          { provide: SprintClient, useValue: sprintClientMock },
          { provide: TaskClient, useValue: taskClientMock },
          { provide: AuthStore, useValue: authStoreMock },
        ],
      });

      const fixture = TestBed.createComponent(SprintDetail);

      fixture.componentRef.setInput('sprintId', mockSprint.id);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component.loading()).toBe(false);
      expect(component.sprint()).toBeNull();
    });
  });

  // ── Helper methods ─────────────────────────────────────────────────────

  describe('getStatusColor', () => {
    beforeEach(() => setup());

    it('should return color for planned', () => {
      expect(component.getStatusColor('planned')).toBe('bg-blue-100 text-blue-700');
    });

    it('should return color for active', () => {
      expect(component.getStatusColor('active')).toBe('bg-green-100 text-green-700');
    });

    it('should return color for completed', () => {
      expect(component.getStatusColor('completed')).toBe('bg-gray-100 text-gray-600');
    });

    it('should return fallback for unknown', () => {
      expect(component.getStatusColor('unknown')).toBe('bg-gray-100 text-gray-700');
    });
  });

  describe('getPriorityDot', () => {
    beforeEach(() => setup());

    it('should return correct dot color for each priority', () => {
      expect(component.getPriorityDot('low')).toBe('bg-blue-500');
      expect(component.getPriorityDot('medium')).toBe('bg-yellow-500');
      expect(component.getPriorityDot('high')).toBe('bg-orange-500');
      expect(component.getPriorityDot('critical')).toBe('bg-red-500');
      expect(component.getPriorityDot('unknown')).toBe('bg-gray-500');
    });
  });

  describe('getPriorityBadge', () => {
    beforeEach(() => setup());

    it('should return correct badge color for each priority', () => {
      expect(component.getPriorityBadge('low')).toBe('bg-blue-100 text-blue-700');
      expect(component.getPriorityBadge('medium')).toBe('bg-yellow-100 text-yellow-700');
      expect(component.getPriorityBadge('high')).toBe('bg-orange-100 text-orange-700');
      expect(component.getPriorityBadge('critical')).toBe('bg-red-100 text-red-700');
      expect(component.getPriorityBadge('unknown')).toBe('bg-gray-100 text-gray-700');
    });
  });

  // ── removeTaskFromSprint ───────────────────────────────────────────────

  describe('removeTaskFromSprint', () => {
    beforeEach(() => setup());

    it('should call sprintClient.removeTask', () => {
      component.removeTaskFromSprint('tk1');

      expect(sprintClientMock.removeTask).toHaveBeenCalledWith(mockSprint.id, 'tk1');
    });

    it('should remove task from sprintTasks signal', () => {
      component.removeTaskFromSprint('tk1');

      expect(component.sprintTasks()).toHaveLength(1);
      expect(component.sprintTasks().find((t: Task) => t.id === 'tk1')).toBeUndefined();
    });

    it('should update sprint taskIds', () => {
      component.removeTaskFromSprint('tk1');

      expect(component.sprint().taskIds).not.toContain('tk1');
    });
  });
});
