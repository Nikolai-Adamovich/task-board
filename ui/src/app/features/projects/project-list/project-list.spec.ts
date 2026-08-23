/**
 * Tests for the ProjectList component.
 *
 * Covers:
 * - Loading projects on init
 * - createProject validation & submission (with key field)
 * - canCreate check
 * - onDialogStateChange
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { submit } from '@angular/forms/signals';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { ProjectList, CreateProjectForm } from './project-list';
import { ProjectClient } from '@services/project-client';
import { TenantStore } from '@stores/tenant-store';
import { AuthStore } from '@stores/auth-store';
import { API_BASE_URL } from '@app/api-url.token';
import type { Project, User } from '@task-board/shared';
import type { TenantWithRole } from '@app/types/frontend';

const NOW = '2025-01-01T00:00:00Z';
const mockProjects: Project[] = [
  {
    id: 'p1',
    tenantId: 't1',
    key: 'PA',
    name: 'Project A',
    description: null,
    status: 'ACTIVE',
    defaultStatusId: 's1',
    defaultBoardId: 'b1',
    archiveReason: null,
    deletionScheduledAt: null,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'p2',
    tenantId: 't1',
    key: 'PB',
    name: 'Project B',
    description: 'Desc B',
    status: 'ACTIVE',
    defaultStatusId: 's1',
    defaultBoardId: 'b1',
    archiveReason: null,
    deletionScheduledAt: null,
    createdAt: NOW,
    updatedAt: NOW,
  },
];
const mockTenant: TenantWithRole = {
  id: 't1',
  name: 'Acme',
  description: null,
  status: 'ACTIVE',
  deletionScheduledAt: null,
  role: 'OWNER',
  createdAt: NOW,
  updatedAt: NOW,
};

describe('ProjectList', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let component: any;
  let projectClientMock: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  let tenantStoreMock: { activeTenant: ReturnType<typeof vi.fn> };
  let authStoreMock: { currentUser: ReturnType<typeof vi.fn> };

  function setup(hasTenant = true, hasUser = true) {
    projectClientMock = {
      list: vi.fn().mockReturnValue(of({ data: mockProjects })),
      create: vi.fn().mockReturnValue(of({ data: { ...mockProjects[0], id: 'p3', name: 'New Project', key: 'NP' } })),
    };
    tenantStoreMock = {
      activeTenant: vi.fn().mockReturnValue(hasTenant ? mockTenant : null),
    };
    authStoreMock = {
      currentUser: vi.fn().mockReturnValue(hasUser ? ({ id: 'u1' } as User) : null),
    };

    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { en: {} } })],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: 'http://localhost/api' },
        { provide: ProjectClient, useValue: projectClientMock },
        { provide: TenantStore, useValue: tenantStoreMock },
        { provide: AuthStore, useValue: authStoreMock },
      ],
    });

    const fixture = TestBed.createComponent(ProjectList);

    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  // ── Loading ─────────────────────────────────────────────

  describe('ngOnInit', () => {
    beforeEach(() => setup());

    it('should load projects when active tenant exists', () => {
      expect(projectClientMock.list).toHaveBeenCalled();
      expect(component.projects()).toEqual(mockProjects);
    });

    it('should set loading to false', () => {
      expect(component.loading()).toBe(false);
    });

    it('should not load projects when no active tenant', () => {
      // Re-setup without tenant
      projectClientMock = {
        list: vi.fn().mockReturnValue(of({ data: [] })),
        create: vi.fn(),
      };
      tenantStoreMock = { activeTenant: vi.fn().mockReturnValue(null) };
      authStoreMock = { currentUser: vi.fn().mockReturnValue(null) };

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [TranslocoTestingModule.forRoot({ langs: { en: {} } })],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([]),
          { provide: API_BASE_URL, useValue: 'http://localhost/api' },
          { provide: ProjectClient, useValue: projectClientMock },
          { provide: TenantStore, useValue: tenantStoreMock },
          { provide: AuthStore, useValue: authStoreMock },
        ],
      });

      const fixture = TestBed.createComponent(ProjectList);

      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(projectClientMock.list).not.toHaveBeenCalled();
    });
  });

  // ── createProject ────────────────────────────────────────

  describe('createProject', () => {
    beforeEach(() => setup());

    it('should not create when name is empty', () => {
      component.model.update((m: CreateProjectForm) => ({ ...m, name: '', key: 'NP' }));
      submit(component.newProjectForm);
      expect(projectClientMock.create).not.toHaveBeenCalled();
    });

    it('should not create when key is empty', () => {
      component.model.update((m: CreateProjectForm) => ({ ...m, name: 'Name', key: '' }));
      submit(component.newProjectForm);
      expect(projectClientMock.create).not.toHaveBeenCalled();
    });

    it('should create project and add to list', () => {
      component.model.update((m: CreateProjectForm) => ({ ...m, name: 'New Project', key: 'NP' }));
      submit(component.newProjectForm);

      expect(projectClientMock.create).toHaveBeenCalled();
      expect(component.projects()).toHaveLength(3);
      expect(component.showCreateModal()).toBe(false);
    });

    it('should reset form after creation', () => {
      component.model.update((m: CreateProjectForm) => ({ ...m, name: 'New Project', key: 'NP' }));
      submit(component.newProjectForm);

      expect(component.model().name).toBe('');
      expect(component.model().key).toBe('');
    });

    it('should set creating to false on error', () => {
      projectClientMock.create.mockReturnValueOnce(throwError(() => new Error('fail')));
      component.model.update((m: CreateProjectForm) => ({ ...m, name: 'Fail', key: 'FL' }));
      submit(component.newProjectForm);

      expect(component.loading()).toBe(false);
    });
  });

  // ── canCreate ────────────────────────────────────────────

  describe('canCreate', () => {
    it('should return true when user is authenticated', () => {
      setup();
      expect(component.canCreate()).toBe(true);
    });

    it('should return false when user is not authenticated', () => {
      setup(true, false);
      expect(component.canCreate()).toBe(false);
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
