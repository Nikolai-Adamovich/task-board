/**
 * Tests for the WorkspaceDetail component.
 *
 * Covers:
 * - Computed signals (tenant, role, isOwnerOrAdmin, isOwner, showUpgrade)
 * - Loading projects on init
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { WorkspaceDetail } from './workspace-detail';
import { ProjectClient } from '@services/project-client';
import { TenantStore } from '@stores/tenant-store';
import { AuthStore } from '@stores/auth-store';
import { API_BASE_URL } from '@app/api-url.token';
import type { Project, User } from '@task-board/shared';
import type { TenantWithRole } from '@app/types/frontend';

const NOW = '2025-01-01T00:00:00Z';
const mockFreeTenant: TenantWithRole = {
  id: 't1',
  name: 'Acme',
  description: null,
  status: 'ACTIVE',
  deletionScheduledAt: null,
  role: 'OWNER',
  createdAt: NOW,
  updatedAt: NOW,
};
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
];

describe('WorkspaceDetail', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let component: any;
  let projectClientMock: { list: ReturnType<typeof vi.fn> };
  let tenantStoreMock: { activeTenant: ReturnType<typeof vi.fn> };
  let authStoreMock: { tenantRole: ReturnType<typeof vi.fn>; currentUser: ReturnType<typeof vi.fn> };

  function setup(tenant: TenantWithRole | null = mockFreeTenant, role = 'OWNER') {
    projectClientMock = {
      list: vi.fn().mockReturnValue(of(mockProjects)),
    };
    tenantStoreMock = {
      activeTenant: vi.fn().mockReturnValue(tenant),
    };
    authStoreMock = {
      tenantRole: vi.fn().mockReturnValue(role),
      currentUser: vi.fn().mockReturnValue({ id: 'u1' } as User),
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

    const fixture = TestBed.createComponent(WorkspaceDetail);

    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  // ── Computed signals ───────────────────────────────────────────────────

  describe('computed signals', () => {
    it('should compute tenant from active tenant', () => {
      setup();
      expect(component.tenant()).toEqual(mockFreeTenant);
    });

    it('should compute role from authStore', () => {
      setup();
      expect(component.role()).toBe('OWNER');
    });

    it('isOwnerOrAdmin should be true for OWNER', () => {
      setup(mockFreeTenant, 'OWNER');
      expect(component.isOwnerOrAdmin()).toBe(true);
    });

    it('isOwnerOrAdmin should be true for ADMIN', () => {
      setup(mockFreeTenant, 'ADMIN');
      expect(component.isOwnerOrAdmin()).toBe(true);
    });

    it('isOwnerOrAdmin should be false for MEMBER', () => {
      setup(mockFreeTenant, 'MEMBER');
      expect(component.isOwnerOrAdmin()).toBe(false);
    });
  });

  // ── Loading projects ───────────────────────────────────────────────────

  describe('ngOnInit', () => {
    beforeEach(() => setup());

    it('should load projects', () => {
      expect(projectClientMock.list).toHaveBeenCalled();
      expect(component.projects()).toEqual(mockProjects);
    });

    it('should set loadingProjects to false', () => {
      expect(component.loadingProjects()).toBe(false);
    });

    it('should set empty projects on error', async () => {
      projectClientMock = {
        list: vi.fn().mockReturnValue(throwError(() => new Error('fail'))),
      };
      tenantStoreMock = { activeTenant: vi.fn().mockReturnValue(mockFreeTenant) };
      authStoreMock = { tenantRole: vi.fn().mockReturnValue('OWNER'), currentUser: vi.fn().mockReturnValue(null) };

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

      const fixture = TestBed.createComponent(WorkspaceDetail);

      component = fixture.componentInstance;
      fixture.detectChanges();

      await new Promise((r) => setTimeout(r, 0));
      expect(component.projects()).toEqual([]);
      expect(component.loadingProjects()).toBe(false);
    });
  });
});
