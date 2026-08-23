/**
 * Tests for the Dashboard component.
 *
 * Covers:
 * - dashboardState computed signal
 * - Auth flow (fetchCurrentUser when token but no user)
 * - Loading tenants and data
 * - onInvitationHandled reload
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { Dashboard } from './dashboard';
import { AuthStore } from '@stores/auth-store';
import { TenantStore } from '@stores/tenant-store';
import { TenantClient } from '@services/tenant-client';
import { TaskClient } from '@services/task-client';
import { API_BASE_URL } from '@app/api-url.token';
import type { User } from '@task-board/shared';
import type { TenantWithRole } from '@app/types/frontend';

const NOW = '2025-01-01T00:00:00Z';
const mockTenants: TenantWithRole[] = [
  {
    id: 't1',
    name: 'Acme',
    description: null,
    status: 'ACTIVE',
    deletionScheduledAt: null,
    role: 'OWNER',
    createdAt: NOW,
    updatedAt: NOW,
  },
];

describe('Dashboard', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let component: any;
  let authStoreMock: {
    isAuthenticated: ReturnType<typeof vi.fn>;
    currentUser: ReturnType<typeof vi.fn>;
    token: ReturnType<typeof vi.fn>;
    fetchCurrentUser: ReturnType<typeof vi.fn>;
  };
  let tenantStoreMock: {
    tenants: ReturnType<typeof vi.fn>;
    loadTenants: ReturnType<typeof vi.fn>;
  };
  let tenantClientMock: { getMyInvitations: ReturnType<typeof vi.fn> };
  let taskClientMock: { getMyTasks: ReturnType<typeof vi.fn> };

  function setup(
    opts: {
      authenticated?: boolean;
      hasUser?: boolean;
      token?: string | null;
      tenants?: TenantWithRole[];
      fetchCurrentUserMock?: () => Promise<User>;
    } = {},
  ) {
    const {
      authenticated = true,
      hasUser = true,
      token = 'test-token',
      tenants = mockTenants,
      fetchCurrentUserMock,
    } = opts;

    authStoreMock = {
      isAuthenticated: vi.fn().mockReturnValue(authenticated),
      currentUser: vi.fn().mockReturnValue(hasUser ? ({ id: 'u1' } as User) : null),
      token: vi.fn().mockReturnValue(token),
      fetchCurrentUser: fetchCurrentUserMock
        ? vi.fn().mockImplementation(fetchCurrentUserMock)
        : vi.fn().mockResolvedValue({ id: 'u1' } as User),
    };
    tenantStoreMock = {
      tenants: vi.fn().mockReturnValue(tenants),
      loadTenants: vi.fn().mockResolvedValue(tenants),
    };
    tenantClientMock = {
      getMyInvitations: vi.fn().mockReturnValue(of([])),
    };
    taskClientMock = {
      getMyTasks: vi.fn().mockReturnValue(of([])),
    };

    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { en: {} } })],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: 'http://localhost/api' },
        { provide: AuthStore, useValue: authStoreMock },
        { provide: TenantStore, useValue: tenantStoreMock },
        { provide: TenantClient, useValue: tenantClientMock },
        { provide: TaskClient, useValue: taskClientMock },
      ],
    });

    const fixture = TestBed.createComponent(Dashboard);

    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  describe('authenticated user with tenants', () => {
    beforeEach(() => setup());

    it('should load tenants via tenantStore', async () => {
      // loadTenants is called in ngOnInit
      expect(tenantStoreMock.loadTenants).toHaveBeenCalled();
    });

    it('should load invitations and tasks', () => {
      expect(tenantClientMock.getMyInvitations).toHaveBeenCalled();
      expect(taskClientMock.getMyTasks).toHaveBeenCalled();
    });

    it('should set loading to false after data loads', () => {
      expect(component.loading()).toBe(false);
    });

    it('dashboardState should be OWNER for owner role', () => {
      expect(component.dashboardState()).toBe('OWNER');
    });
  });

  describe('authenticated user without tenants', () => {
    it('dashboardState should be new-user', async () => {
      authStoreMock = {
        isAuthenticated: vi.fn().mockReturnValue(true),
        currentUser: vi.fn().mockReturnValue({ id: 'u1' } as User),
        token: vi.fn().mockReturnValue('tok'),
        fetchCurrentUser: vi.fn().mockResolvedValue({ id: 'u1' } as User),
      };
      tenantStoreMock = {
        tenants: vi.fn().mockReturnValue([]),
        loadTenants: vi.fn().mockResolvedValue([]),
      };
      tenantClientMock = { getMyInvitations: vi.fn().mockReturnValue(of([])) };
      taskClientMock = { getMyTasks: vi.fn().mockReturnValue(of([])) };

      TestBed.configureTestingModule({
        imports: [TranslocoTestingModule.forRoot({ langs: { en: {} } })],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([]),
          { provide: API_BASE_URL, useValue: 'http://localhost/api' },
          { provide: AuthStore, useValue: authStoreMock },
          { provide: TenantStore, useValue: tenantStoreMock },
          { provide: TenantClient, useValue: tenantClientMock },
          { provide: TaskClient, useValue: taskClientMock },
        ],
      });

      const fixture = TestBed.createComponent(Dashboard);

      component = fixture.componentInstance;
      fixture.detectChanges();

      // Wait for async tenant loading
      await new Promise((r) => setTimeout(r, 0));

      expect(component.dashboardState()).toBe('new-user');
    });
  });

  describe('unauthenticated user', () => {
    it('dashboardState should be visitor', () => {
      authStoreMock = {
        isAuthenticated: vi.fn().mockReturnValue(false),
        currentUser: vi.fn().mockReturnValue(null),
        token: vi.fn().mockReturnValue(null),
        fetchCurrentUser: vi.fn(),
      };
      tenantStoreMock = { tenants: vi.fn().mockReturnValue([]), loadTenants: vi.fn() };
      tenantClientMock = { getMyInvitations: vi.fn() };
      taskClientMock = { getMyTasks: vi.fn() };

      TestBed.configureTestingModule({
        imports: [TranslocoTestingModule.forRoot({ langs: { en: {} } })],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([]),
          { provide: API_BASE_URL, useValue: 'http://localhost/api' },
          { provide: AuthStore, useValue: authStoreMock },
          { provide: TenantStore, useValue: tenantStoreMock },
          { provide: TenantClient, useValue: tenantClientMock },
          { provide: TaskClient, useValue: taskClientMock },
        ],
      });

      const fixture = TestBed.createComponent(Dashboard);

      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component.dashboardState()).toBe('visitor');
      expect(component.loading()).toBe(false);
    });
  });

  describe('onInvitationHandled', () => {
    beforeEach(() => setup());

    it('should reload tenants and data', async () => {
      // Reset the mock call counts
      tenantStoreMock.loadTenants.mockClear();
      tenantClientMock.getMyInvitations.mockClear();
      taskClientMock.getMyTasks.mockClear();

      component.onInvitationHandled();

      expect(component.loading()).toBe(true);

      await new Promise((r) => setTimeout(r, 0));

      expect(tenantStoreMock.loadTenants).toHaveBeenCalled();
    });
  });
});
