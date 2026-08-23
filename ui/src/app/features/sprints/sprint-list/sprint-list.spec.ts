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
import { submit } from '@angular/forms/signals';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { SprintList, CreateSprintForm } from './sprint-list';
import { SprintClient } from '@services/sprint-client';
import { AuthStore } from '@stores/auth-store';
import { ProjectStore } from '@stores/project-store';
import { API_BASE_URL } from '@app/api-url.token';
import { NeutralColor } from '@app/constants/priority';
import type { Sprint, User } from '@task-board/shared';

const NOW = '2025-01-01T00:00:00Z';
const mockSprints: Sprint[] = [
  {
    id: 'sp1',
    projectId: 'p1',
    name: 'Sprint 1',
    startDate: NOW,
    endDate: '2025-02-01T00:00:00Z',
    status: 'ACTIVE',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'sp2',
    projectId: 'p2',
    name: 'Sprint 2',
    startDate: NOW,
    endDate: '2025-02-01T00:00:00Z',
    status: 'FUTURE',
    createdAt: NOW,
    updatedAt: NOW,
  },
];

describe('SprintList', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let component: any;
  let sprintClientMock: {
    list: ReturnType<typeof vi.fn>;
    listByTenant: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  let authStoreMock: {
    currentUser: ReturnType<typeof vi.fn>;
    isAuthenticated: () => boolean;
    token: () => string | null;
    tenantRole: () => string | null;
  };

  function setup(projectId?: string) {
    sprintClientMock = {
      list: vi.fn().mockReturnValue(of(mockSprints)),
      listByTenant: vi.fn().mockReturnValue(of(mockSprints)),
      create: vi.fn().mockReturnValue(of(mockSprints[0])),
    };
    authStoreMock = {
      currentUser: vi.fn().mockReturnValue({ id: 'u1' } as User),
      isAuthenticated: () => true,
      token: () => 'fake-jwt',
      tenantRole: () => 'OWNER',
    };

    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { en: {} } })],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: 'http://localhost/api' },
        { provide: SprintClient, useValue: sprintClientMock },
        { provide: AuthStore, useValue: authStoreMock },
        {
          provide: ProjectStore,
          useValue: { activeProject: () => (projectId ? { id: projectId } : null), projectRole: () => null },
        },
      ],
    });

    const fixture = TestBed.createComponent(SprintList);

    if (projectId) {
      fixture.componentRef.setInput('projectKey', projectId);
    }

    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  // ── Loading ─────────────────────────────────────────────

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

    it('should call sprintClient.list when no projectId', () => {
      expect(sprintClientMock.list).toHaveBeenCalled();
    });

    it('should populate sprints signal', () => {
      expect(component.sprints()).toEqual(mockSprints);
    });

    it('should set loading to false', () => {
      expect(component.loading()).toBe(false);
    });

    it('should handle error and set loading to false', () => {
      sprintClientMock = {
        list: vi.fn().mockReturnValue(throwError(() => new Error('fail'))),
        listByTenant: vi.fn(),
        create: vi.fn(),
      };
      authStoreMock = {
        currentUser: vi.fn().mockReturnValue(null),
        isAuthenticated: () => false,
        token: () => null,
        tenantRole: () => null,
      };

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [TranslocoTestingModule.forRoot({ langs: { en: {} } })],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([]),
          { provide: API_BASE_URL, useValue: 'http://localhost/api' },
          { provide: SprintClient, useValue: sprintClientMock },
          { provide: AuthStore, useValue: authStoreMock },
          { provide: ProjectStore, useValue: { activeProject: () => null, projectRole: () => null } },
        ],
      });

      const fixture = TestBed.createComponent(SprintList);

      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component.loading()).toBe(false);
    });
  });

  // ── getStatusColor ──────────────────────────────────────

  describe('getStatusColor', () => {
    beforeEach(() => setup());

    it('should return correct color for each status', () => {
      expect(component.getStatusColor('FUTURE')).toBe('bg-blue-100 text-blue-700');
      expect(component.getStatusColor('ACTIVE')).toBe('bg-green-100 text-green-700');
      expect(component.getStatusColor('COMPLETED')).toBe('bg-gray-100 text-gray-600');
    });

    it('should return fallback for unknown', () => {
      expect(component.getStatusColor('unknown')).toBe(NeutralColor);
    });
  });

  // ── toggleGroup ──────────────────────────────────────

  describe('isGroupExpanded / toggleGroup', () => {
    beforeEach(() => setup());

    it('should default to expanded', () => {
      expect(component.isGroupExpanded('p1')).toBe(true);
    });

    it('should toggle to expanded', () => {
      component.toggleGroup('p1');
      expect(component.isGroupExpanded('p1')).toBe(true);
    });

    it('should toggle back to collapsed', () => {
      component.toggleGroup('p1');
      component.toggleGroup('p1');
      expect(component.isGroupExpanded('p1')).toBe(false);
    });
  });

  // ── createSprint ────────────────────────────────────────

  describe('createSprint', () => {
    beforeEach(() => setup('p1'));

    it('should not create when name is empty', () => {
      component.model.update((m: CreateSprintForm) => ({ ...m, name: '' }));
      component.model.update((m: CreateSprintForm) => ({ ...m, startDate: '2025-01-01' }));
      component.model.update((m: CreateSprintForm) => ({ ...m, endDate: '2025-02-01' }));
      submit(component.newSprintForm);
      expect(sprintClientMock.create).not.toHaveBeenCalled();
    });

    it('should create sprint and add to list', () => {
      component.model.update((m: CreateSprintForm) => ({ ...m, name: 'New Sprint' }));
      component.model.update((m: CreateSprintForm) => ({ ...m, startDate: '2025-01-01' }));
      component.model.update((m: CreateSprintForm) => ({ ...m, endDate: '2025-02-01' }));
      submit(component.newSprintForm);

      expect(sprintClientMock.create).toHaveBeenCalled();
      expect(component.sprints()).toHaveLength(3);
      expect(component.showCreateModal()).toBe(false);
    });

    it('should reset form after creation', () => {
      component.model.update((m: CreateSprintForm) => ({ ...m, name: 'New Sprint' }));
      component.model.update((m: CreateSprintForm) => ({ ...m, startDate: '2025-01-01' }));
      component.model.update((m: CreateSprintForm) => ({ ...m, endDate: '2025-02-01' }));
      submit(component.newSprintForm);

      expect(component.model().name).toBe('');
      expect(component.model().startDate).toBe('');
      expect(component.model().endDate).toBe('');
    });

    it('should set creating to false on error', () => {
      sprintClientMock.create.mockReturnValueOnce(throwError(() => new Error('fail')));
      component.model.update((m: CreateSprintForm) => ({ ...m, name: 'Fail Sprint' }));
      component.model.update((m: CreateSprintForm) => ({ ...m, startDate: '2025-01-01' }));
      component.model.update((m: CreateSprintForm) => ({ ...m, endDate: '2025-02-01' }));
      submit(component.newSprintForm);

      expect(component.loading()).toBe(false);
    });
  });

  // ── onDialogStateChange ──────────────────────────────────

  describe('onDialogStateChange', () => {
    beforeEach(() => setup());

    it('should close dialog on closed state', () => {
      component.showCreateModal.set(true);
      component.onDialogStateChange('closed');
      expect(component.showCreateModal()).toBe(false);
    });
  });
});
