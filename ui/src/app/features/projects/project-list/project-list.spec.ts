/**
 * Tests for the ProjectList component.
 *
 * Covers:
 * - Loading projects on init
 * - createProject validation & submission
 * - canCreate check
 * - onDialogStateChange
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ProjectList } from './project-list';
import { ProjectClient } from '@services/project-client';
import { TenantStore } from '@stores/tenant-store';
import { AuthStore } from '@stores/auth-store';
import { API_BASE_URL } from '@app/api-url.token';
import type { Project, TenantWithRole, User } from '@task-board/shared';

const NOW = '2025-01-01T00:00:00Z';
const mockProjects: Project[] = [
  { id: 'p1', tenantId: 't1', name: 'Project A', slug: 'project-a', description: null, createdAt: NOW, updatedAt: NOW },
  {
    id: 'p2',
    tenantId: 't1',
    name: 'Project B',
    slug: 'project-b',
    description: 'Desc B',
    createdAt: NOW,
    updatedAt: NOW,
  },
];
const mockTenant: TenantWithRole = {
  id: 't1',
  name: 'Acme',
  slug: 'acme',
  description: null,
  subscription: 'free',
  role: 'owner',
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
      list: vi.fn().mockReturnValue(of({ data: mockProjects, total: 2, page: 1, limit: 20 })),
      create: vi.fn().mockReturnValue(of({ ...mockProjects[0], id: 'p3', name: 'New Project' })),
    };
    tenantStoreMock = {
      activeTenant: vi.fn().mockReturnValue(hasTenant ? mockTenant : null),
    };
    authStoreMock = {
      currentUser: vi.fn().mockReturnValue(hasUser ? ({ id: 'u1' } as User) : null),
    };

    TestBed.configureTestingModule({
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

  // ── Loading ─────────────────────────────────────────────────────────────

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
        list: vi.fn().mockReturnValue(of({ data: [], total: 0, page: 1, limit: 20 })),
        create: vi.fn(),
      };
      tenantStoreMock = { activeTenant: vi.fn().mockReturnValue(null) };
      authStoreMock = { currentUser: vi.fn().mockReturnValue(null) };

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
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

  // ── createProject ──────────────────────────────────────────────────────

  describe('createProject', () => {
    beforeEach(() => setup());

    it('should not create when name is empty', () => {
      component.newProject.name = '';
      component.newProject.slug = 'slug';
      component.createProject();
      expect(projectClientMock.create).not.toHaveBeenCalled();
    });

    it('should not create when slug is empty', () => {
      component.newProject.name = 'Name';
      component.newProject.slug = '';
      component.createProject();
      expect(projectClientMock.create).not.toHaveBeenCalled();
    });

    it('should create project and add to list', () => {
      component.newProject.name = 'New Project';
      component.newProject.slug = 'new-project';
      component.createProject();

      expect(projectClientMock.create).toHaveBeenCalled();
      expect(component.projects()).toHaveLength(3);
      expect(component.showCreateModal()).toBe(false);
    });

    it('should reset form after creation', () => {
      component.newProject.name = 'New Project';
      component.newProject.slug = 'new-project';
      component.createProject();

      expect(component.newProject.name).toBe('');
      expect(component.newProject.slug).toBe('');
    });

    it('should set creating to false on error', () => {
      projectClientMock.create.mockReturnValueOnce(throwError(() => new Error('fail')));
      component.newProject.name = 'Fail';
      component.newProject.slug = 'fail';
      component.createProject();

      expect(component.creating()).toBe(false);
    });
  });

  // ── canCreate ──────────────────────────────────────────────────────────

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
