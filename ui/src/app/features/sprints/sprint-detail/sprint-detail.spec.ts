/**
 * Tests for the SprintDetail component.
 *
 * Covers:
 * - Loading sprint and tasks on init
 * - Loading/error states
 * - getStatusColor, getPriorityDot, getPriorityBadge helpers
 * - removeTaskFromSprint
 * - Status transitions
 * - Delete sprint
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router, ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { SprintDetail } from './sprint-detail';
import { SprintClient } from '@services/sprint-client';
import { TaskClient } from '@services/task-client';
import { AuthStore } from '@stores/auth-store';
import { API_BASE_URL } from '@app/api-url.token';
import { NeutralColor, NeutralDotColor } from '@app/constants/priority';
import type { Sprint, Task, User } from '@task-board/shared';

const NOW = '2025-01-01T00:00:00Z';
const mockSprint: Sprint = {
  id: 'sp000000-0000-0000-0000-000000000001',
  projectId: 'p0000000-0000-0000-0000-000000000001',
  name: 'Sprint 1',
  startDate: NOW,
  endDate: '2025-02-01T00:00:00Z',
  status: 'ACTIVE',
  createdAt: NOW,
  updatedAt: NOW,
};
const mockSprintTasks: Task[] = [
  {
    id: 'tk1',
    projectId: mockSprint.projectId,
    number: 1,
    typeId: 'type1',
    title: 'Task 1',
    description: null,
    statusId: 's1',
    priority: 'HIGH',
    reporterId: null,
    reporterSnapshot: null,
    assigneeId: null,
    assigneeSnapshot: null,
    sprintId: mockSprint.id,
    labelIds: [],
    createdById: 'u1',
    createdBySnapshot: { displayName: 'Test User' },
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'tk2',
    projectId: mockSprint.projectId,
    number: 2,
    typeId: 'type1',
    title: 'Task 2',
    description: null,
    statusId: 's1',
    priority: 'LOW',
    reporterId: null,
    reporterSnapshot: null,
    assigneeId: null,
    assigneeSnapshot: null,
    sprintId: mockSprint.id,
    labelIds: [],
    createdById: 'u1',
    createdBySnapshot: { displayName: 'Test User' },
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
  },
];

describe('SprintDetail', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let component: any;
  let sprintClientMock: {
    getById: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let taskClientMock: { list: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  let authStoreMock: {
    currentUser: ReturnType<typeof vi.fn>;
    isAuthenticated: () => boolean;
    token: () => string | null;
    tenantRole: () => string | null;
  };
  let routerMock: { navigate: ReturnType<typeof vi.fn> };

  function setup(sprintOverrides: Partial<Sprint> = {}) {
    const sprint = { ...mockSprint, ...sprintOverrides };

    sprintClientMock = {
      getById: vi.fn().mockReturnValue(of(sprint)),
      update: vi.fn().mockReturnValue(of({ ...sprint, status: 'COMPLETED' })),
      delete: vi.fn().mockReturnValue(of(undefined)),
    };
    taskClientMock = {
      list: vi
        .fn()
        .mockReturnValue(of({ data: mockSprintTasks, pagination: { total: 2, page: 1, limit: 200, totalPages: 1 } })),
      update: vi.fn().mockReturnValue(of(mockSprintTasks[0])),
    };
    authStoreMock = {
      currentUser: vi.fn().mockReturnValue({ id: 'u1' } as User),
      isAuthenticated: () => true,
      token: () => 'fake-jwt',
      tenantRole: () => 'OWNER',
    };
    routerMock = {
      navigate: vi.fn().mockResolvedValue(true),
    };

    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { en: {} } })],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: 'http://localhost/api' },
        { provide: SprintClient, useValue: sprintClientMock },
        { provide: TaskClient, useValue: taskClientMock },
        { provide: AuthStore, useValue: authStoreMock },
        { provide: Router, useValue: routerMock },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: () => 't1' } },
            parent: { snapshot: { paramMap: { get: () => 't1' } }, parent: null },
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(SprintDetail);

    fixture.componentRef.setInput('sprintId', mockSprint.id);

    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  // ── Loading ─────────────────────────────────────────────────────

  describe('ngOnInit', () => {
    beforeEach(() => setup());

    it('should call sprintClient.getById on init', () => {
      expect(sprintClientMock.getById).toHaveBeenCalledWith(mockSprint.id);
    });

    it('should populate the sprint signal', () => {
      expect(component.sprint()).toBeTruthy();
      expect(component.sprint().name).toBe('Sprint 1');
    });

    it('should load sprint tasks via taskClient.list', () => {
      expect(taskClientMock.list).toHaveBeenCalledWith(mockSprint.projectId, { sprintId: mockSprint.id, limit: 200 });
      expect(component.sprintTasks()).toHaveLength(2);
    });

    it('should set loading to false', () => {
      expect(component.loading()).toBe(false);
    });

    it('should set loading to false on error', () => {
      sprintClientMock = {
        getById: vi.fn().mockReturnValue(throwError(() => new Error('fail'))),
        update: vi.fn(),
        delete: vi.fn(),
      };
      taskClientMock = { list: vi.fn(), update: vi.fn() };
      authStoreMock = {
        currentUser: vi.fn().mockReturnValue(null),
        isAuthenticated: () => false,
        token: () => null,
        tenantRole: () => null,
      };
      routerMock = { navigate: vi.fn() };

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
          { provide: Router, useValue: routerMock },
          {
            provide: ActivatedRoute,
            useValue: {
              snapshot: { paramMap: { get: () => 't1' } },
              parent: { snapshot: { paramMap: { get: () => 't1' } }, parent: null },
            },
          },
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

  // ── Helper methods ─────────────────────────────────────────────

  describe('getStatusColor', () => {
    beforeEach(() => setup());

    it('should return color for FUTURE', () => {
      expect(component.getStatusColor('FUTURE')).toBe('bg-blue-100 text-blue-700');
    });

    it('should return color for ACTIVE', () => {
      expect(component.getStatusColor('ACTIVE')).toBe('bg-green-100 text-green-700');
    });

    it('should return color for COMPLETED', () => {
      expect(component.getStatusColor('COMPLETED')).toBe('bg-gray-100 text-gray-600');
    });

    it('should return fallback for unknown', () => {
      expect(component.getStatusColor('unknown')).toBe(NeutralColor);
    });
  });

  describe('getPriorityDot', () => {
    beforeEach(() => setup());

    it('should return correct dot color for each priority', () => {
      expect(component.getPriorityDot('LOW')).toBe('bg-blue-500');
      expect(component.getPriorityDot('MEDIUM')).toBe('bg-yellow-500');
      expect(component.getPriorityDot('HIGH')).toBe('bg-orange-500');
      expect(component.getPriorityDot('CRITICAL')).toBe('bg-red-500');
      expect(component.getPriorityDot('unknown')).toBe(NeutralDotColor);
    });
  });

  describe('getPriorityBadge', () => {
    beforeEach(() => setup());

    it('should return correct badge color for each priority', () => {
      expect(component.getPriorityBadge('LOW')).toBe('bg-blue-100 text-blue-700');
      expect(component.getPriorityBadge('MEDIUM')).toBe('bg-yellow-100 text-yellow-700');
      expect(component.getPriorityBadge('HIGH')).toBe('bg-orange-100 text-orange-700');
      expect(component.getPriorityBadge('CRITICAL')).toBe('bg-red-100 text-red-700');
      expect(component.getPriorityBadge('unknown')).toBe(NeutralColor);
    });
  });

  // ── Status transitions ────────────────────────────────────────

  describe('status transitions', () => {
    it('should show Start Sprint for FUTURE sprint', () => {
      setup({ status: 'FUTURE' });
      expect(component.availableTransitions).toEqual([{ label: 'Start Sprint', status: 'ACTIVE' }]);
    });

    it('should show Complete Sprint for ACTIVE sprint', () => {
      setup({ status: 'ACTIVE' });
      expect(component.availableTransitions).toEqual([{ label: 'Complete Sprint', status: 'COMPLETED' }]);
    });

    it('should show Reopen Sprint for COMPLETED sprint', () => {
      setup({ status: 'COMPLETED' });
      expect(component.availableTransitions).toEqual([{ label: 'Reopen Sprint', status: 'ACTIVE' }]);
    });

    it('should call sprintClient.update on transitionSprint', () => {
      setup({ status: 'ACTIVE' });
      component.transitionSprint('COMPLETED');

      expect(sprintClientMock.update).toHaveBeenCalledWith(mockSprint.id, { status: 'COMPLETED' });
    });
  });

  // ── removeTaskFromSprint ───────────────────────────────────────────────

  describe('removeTaskFromSprint', () => {
    beforeEach(() => setup());

    it('should call taskClient.update with sprintId null', () => {
      const task = mockSprintTasks[0];

      component.removeTaskFromSprint(task);

      expect(taskClientMock.update).toHaveBeenCalledWith(task.id, { sprintId: null, version: task.version });
    });

    it('should remove task from sprintTasks signal', () => {
      component.removeTaskFromSprint(mockSprintTasks[0]);

      expect(component.sprintTasks()).toHaveLength(1);
      expect(component.sprintTasks().find((t: Task) => t.id === 'tk1')).toBeUndefined();
    });
  });

  // ── Delete sprint ─────────────────────────────────────────────

  describe('deleteSprint', () => {
    beforeEach(() => setup());

    it('should call sprintClient.delete', () => {
      component.deleteSprint();

      expect(sprintClientMock.delete).toHaveBeenCalledWith(mockSprint.id);
    });

    it('should navigate to project after deletion', () => {
      component.deleteSprint();

      expect(routerMock.navigate).toHaveBeenCalled();
    });
  });
});
