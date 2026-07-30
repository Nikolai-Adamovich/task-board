/**
 * Tests for the SprintList component.
 *
 * Covers:
 * - Loading sprints (project-level and tenant-level)
 * - createSprint validation & submission
 * - getStatusColor helper
 * - isGroupExpanded / toggleGroup
 * - onDialogStateChange
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { SprintList } from './sprint-list';
import { SprintClient } from '@services/sprint-client';
import { ProjectClient } from '@services/project-client';
import { AuthStore } from '@stores/auth-store';
import { API_BASE_URL } from '@app/api-url.token';
import type { Sprint, Project, User } from '@task-board/shared';

const NOW = '2025-01-01T00:00:00Z';
const mockSprints: Sprint[] = [
  {
    id: 'sp1',
    tenantId: 't1',
    projectId: 'p1',
    name: 'Sprint 1',
    startDate: NOW,
    endDate: '2025-02-01T00:00:00Z',
    goal: null,
    status: 'active',
    taskIds: [],
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'sp2',
    tenantId: 't1',
    projectId: 'p2',
    name: 'Sprint 2',
    startDate: NOW,
    endDate: '2025-02-01T00:00:00Z',
    goal: null,
    status: 'planned',
    taskIds: [],
    createdAt: NOW,
    updatedAt: NOW,
  },
];
const mockProjects: Project[] = [
  { id: 'p1', tenantId: 't1', name: 'Project A', slug: 'project-a', description: null, createdAt: NOW, updatedAt: NOW },
  { id: 'p2', tenantId: 't1', name: 'Project B', slug: 'project-b', description: null, createdAt: NOW, updatedAt: NOW },
];

describe('SprintList', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let component: any;
  let sprintClientMock: {
    list: ReturnType<typeof vi.fn>;
    listByTenant: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  let projectClientMock: { list: ReturnType<typeof vi.fn> };
  let authStoreMock: { currentUser: ReturnType<typeof vi.fn> };

  function setup(projectId?: string) {
    sprintClientMock = {
      list: vi.fn().mockReturnValue(of({ data: mockSprints, total: 2, page: 1, limit: 20 })),
      listByTenant: vi.fn().mockReturnValue(of({ data: mockSprints, total: 2, page: 1, limit: 20 })),
      create: vi.fn().mockReturnValue(of(mockSprints[0])),
    };
    projectClientMock = {
      list: vi.fn().mockReturnValue(of({ data: mockProjects, total: 2, page: 1, limit: 100 })),
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
        { provide: ProjectClient, useValue: projectClientMock },
        { provide: AuthStore, useValue: authStoreMock },
      ],
    });

    const fixture = TestBed.createComponent(SprintList);

    if (projectId) {
      fixture.componentRef.setInput('projectId', projectId);
    }

    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  // ── Loading ─────────────────────────────────────────────────────────────

  describe('ngOnInit - project-level', () => {
    beforeEach(() => setup('p1'));

    it('should call sprintClient.list with projectId', () => {
      expect(sprintClientMock.list).toHaveBeenCalledWith('p1');
    });

    it('should populate sprints signal', () => {
      expect(component.sprints()).toEqual(mockSprints);
    });

    it('should set loading to false', () => {
      expect(component.loading()).toBe(false);
    });
  });

  describe('ngOnInit - tenant-level', () => {
    beforeEach(() => setup());

    it('should call sprintClient.listByTenant when no projectId', () => {
      expect(sprintClientMock.listByTenant).toHaveBeenCalled();
    });

    it('should load projects for name resolution', () => {
      expect(projectClientMock.list).toHaveBeenCalled();
    });

    it('should populate projects signal', () => {
      expect(component.projects()).toEqual(mockProjects);
    });

    it('should set loading to false', () => {
      expect(component.loading()).toBe(false);
    });

    it('should handle error and set loading to false', () => {
      sprintClientMock = {
        list: vi.fn(),
        listByTenant: vi.fn().mockReturnValue(throwError(() => new Error('fail'))),
        create: vi.fn(),
      };
      projectClientMock = { list: vi.fn() };
      authStoreMock = { currentUser: vi.fn().mockReturnValue(null) };

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([]),
          { provide: API_BASE_URL, useValue: 'http://localhost/api' },
          { provide: SprintClient, useValue: sprintClientMock },
          { provide: ProjectClient, useValue: projectClientMock },
          { provide: AuthStore, useValue: authStoreMock },
        ],
      });

      const fixture = TestBed.createComponent(SprintList);

      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component.loading()).toBe(false);
    });
  });

  // ── getStatusColor ────────────────────────────────────────────────────

  describe('getStatusColor', () => {
    beforeEach(() => setup());

    it('should return correct color for each status', () => {
      expect(component.getStatusColor('planned')).toBe('bg-blue-100 text-blue-700');
      expect(component.getStatusColor('active')).toBe('bg-green-100 text-green-700');
      expect(component.getStatusColor('completed')).toBe('bg-gray-100 text-gray-600');
    });

    it('should return fallback for unknown', () => {
      expect(component.getStatusColor('unknown')).toBe('bg-gray-100 text-gray-700');
    });
  });

  // ── toggleGroup ────────────────────────────────────────────────────────

  describe('isGroupExpanded / toggleGroup', () => {
    beforeEach(() => setup());

    it('should default to expanded', () => {
      expect(component.isGroupExpanded('p1')).toBe(true);
    });

    it('should toggle to collapsed', () => {
      component.toggleGroup('p1');
      expect(component.isGroupExpanded('p1')).toBe(false);
    });

    it('should toggle back to expanded', () => {
      component.toggleGroup('p1');
      component.toggleGroup('p1');
      expect(component.isGroupExpanded('p1')).toBe(true);
    });
  });

  // ── createSprint ───────────────────────────────────────────────────────

  describe('createSprint', () => {
    beforeEach(() => setup('p1'));

    it('should not create when name is empty', () => {
      component.newSprint.name = '';
      component.startDateStr = '2025-01-01';
      component.endDateStr = '2025-02-01';
      component.createSprint();
      expect(sprintClientMock.create).not.toHaveBeenCalled();
    });

    it('should not create when startDateStr is empty', () => {
      component.newSprint.name = 'Sprint';
      component.startDateStr = '';
      component.endDateStr = '2025-02-01';
      component.createSprint();
      expect(sprintClientMock.create).not.toHaveBeenCalled();
    });

    it('should create sprint and add to list', () => {
      component.newSprint.name = 'New Sprint';
      component.startDateStr = '2025-01-01';
      component.endDateStr = '2025-02-01';
      component.createSprint();

      expect(sprintClientMock.create).toHaveBeenCalled();
      expect(component.sprints()).toHaveLength(3);
      expect(component.showCreateModal()).toBe(false);
    });

    it('should reset form after creation', () => {
      component.newSprint.name = 'New Sprint';
      component.startDateStr = '2025-01-01';
      component.endDateStr = '2025-02-01';
      component.createSprint();

      expect(component.newSprint.name).toBe('');
      expect(component.startDateStr).toBe('');
      expect(component.endDateStr).toBe('');
    });

    it('should set creating to false on error', () => {
      sprintClientMock.create.mockReturnValueOnce(throwError(() => new Error('fail')));
      component.newSprint.name = 'Fail Sprint';
      component.startDateStr = '2025-01-01';
      component.endDateStr = '2025-02-01';
      component.createSprint();

      expect(component.creating()).toBe(false);
    });
  });

  // ── onDialogStateChange ───────────────────────────────────────────────

  describe('onDialogStateChange', () => {
    beforeEach(() => setup());

    it('should close dialog on closed state', () => {
      component.showCreateModal.set(true);
      component.onDialogStateChange('closed');
      expect(component.showCreateModal()).toBe(false);
    });
  });
});
