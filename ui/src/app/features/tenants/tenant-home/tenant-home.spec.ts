/**
 * Tests for the unified TenantHome component (DEC-033).
 *
 * Covers:
 * - Projects grid rendering with slug-based links
 * - "My Tasks" widget scoped to the active tenant's projects (KEY-NUMBER links)
 * - Pending-invitations summary for OWNER/ADMIN only
 */
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { TenantHome } from './tenant-home';
import { ProjectClient } from '@services/project-client';
import { TaskClient } from '@services/task-client';
import { TenantClient } from '@services/tenant-client';
import { TenantStore } from '@stores/tenant-store';
import { AuthStore } from '@stores/auth-store';
import type { Project, Task, TenantMember } from '@task-board/shared';

const NOW = '2025-01-01T00:00:00Z';
const mockTenant = {
  id: 't1',
  name: 'Acme',
  slug: 'acme',
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
    key: 'ABC',
    name: 'Alpha',
    description: null,
    status: 'ACTIVE',
    deletionScheduledAt: null,
    defaultStatusId: 's1',
    defaultBoardId: 'b1',
    archiveReason: null,
    createdAt: NOW,
    updatedAt: NOW,
  },
];
const mockTasks: Task[] = [
  {
    id: 'tk1',
    projectId: 'p1',
    number: 7,
    typeId: 'type1',
    title: 'First task',
    description: null,
    statusId: 's1',
    priority: 'HIGH',
    reporterId: null,
    reporterSnapshot: null,
    assigneeId: 'u1',
    assigneeSnapshot: null,
    sprintId: null,
    labelIds: [],
    createdById: 'u1',
    createdBySnapshot: { displayName: 'U' },
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'tk2',
    projectId: 'other-tenant-project',
    number: 3,
    typeId: 'type1',
    title: 'Foreign task',
    description: null,
    statusId: 's1',
    priority: 'LOW',
    reporterId: null,
    reporterSnapshot: null,
    assigneeId: 'u1',
    assigneeSnapshot: null,
    sprintId: null,
    labelIds: [],
    createdById: 'u1',
    createdBySnapshot: { displayName: 'U' },
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
  },
];
const mockPendingInvite: TenantMember = {
  id: 'm1',
  tenantId: 't1',
  userId: 'u9',
  role: 'MEMBER',
  status: 'ACCESS_REVOKED',
  invitation: { status: 'PENDING', tokenHash: 'h', invitedBy: 'u1', invitedOn: NOW },
  displayName: null,
  email: 'new@example.com',
  createdAt: NOW,
  updatedAt: NOW,
};

describe('TenantHome', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let component: any;
  let fixture: ComponentFixture<TenantHome>;
  let projectClientMock: { list: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  let taskClientMock: { getMyTasks: ReturnType<typeof vi.fn> };
  let tenantClientMock: { listMembers: ReturnType<typeof vi.fn> };
  let tenantStoreMock: { activeTenant: ReturnType<typeof vi.fn> };
  let authStoreMock: { currentUser: ReturnType<typeof vi.fn>; tenantRole: ReturnType<typeof vi.fn> };

  function setup(opts: { role?: string; myTasks?: Task[] } = {}) {
    const role = opts.role ?? 'OWNER';

    projectClientMock = {
      list: vi.fn().mockReturnValue(of(mockProjects)),
      create: vi.fn(),
    };
    taskClientMock = {
      getMyTasks: vi.fn().mockReturnValue(of(opts.myTasks ?? mockTasks)),
    };
    tenantClientMock = {
      listMembers: vi.fn().mockReturnValue(of([mockPendingInvite])),
    };
    tenantStoreMock = {
      activeTenant: vi.fn().mockReturnValue(mockTenant),
    };
    authStoreMock = {
      currentUser: vi.fn().mockReturnValue({ id: 'u1' }),
      tenantRole: vi.fn().mockReturnValue(role),
    };

    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { en: {} } }), TenantHome],
      providers: [
        provideRouter([]),
        { provide: ProjectClient, useValue: projectClientMock },
        { provide: TaskClient, useValue: taskClientMock },
        { provide: TenantClient, useValue: tenantClientMock },
        { provide: TenantStore, useValue: tenantStoreMock },
        { provide: AuthStore, useValue: authStoreMock },
      ],
    });

    fixture = TestBed.createComponent(TenantHome);

    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('should load the tenant projects', async () => {
    setup();

    await new Promise((r) => setTimeout(r, 0));

    expect(projectClientMock.list).toHaveBeenCalled();
    expect(component.projects()).toEqual(mockProjects);
  });

  it('should scope My Tasks to this tenant and resolve KEY-NUMBER segments', async () => {
    setup();

    // Wait for both resources to emit
    for (let i = 0; i < 20 && component.myTaskItems().length === 0; i++) {
      await new Promise((r) => setTimeout(r, 10));
    }

    const items = component.myTaskItems();

    expect(items).toHaveLength(1);
    expect(items[0].projectKey).toBe('ABC');
    expect(items[0].task.id).toBe('tk1');
  });

  it('should expose pending invitations for admins', async () => {
    setup({ role: 'ADMIN' });

    for (let i = 0; i < 20 && component.pendingInvites().length === 0; i++) {
      await new Promise((r) => setTimeout(r, 10));
    }

    expect(tenantClientMock.listMembers).toHaveBeenCalledWith('t1');
    expect(component.pendingInvites()).toHaveLength(1);
  });

  it('should not fetch members for plain members', async () => {
    setup({ role: 'MEMBER' });

    await new Promise((r) => setTimeout(r, 0));

    expect(tenantClientMock.listMembers).not.toHaveBeenCalled();
  });

  it('should render the standard empty state (icon + title + hint) when My Tasks is empty (DR-8)', async () => {
    setup({ myTasks: [] });

    for (let i = 0; i < 20 && component.myTaskItems().length !== 0; i++) {
      await new Promise((r) => setTimeout(r, 10));
    }
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const empty = el.querySelector('hlm-empty');

    expect(empty).not.toBeNull();
    expect(empty?.querySelector('hlm-empty-media')).not.toBeNull();
    expect(el.textContent).toContain('tenantHome.noTasks');
    expect(el.textContent).toContain('tenantHome.noTasksHint');
  });

  // ── V2-10: role-gated Create-project CTA ──────────────────────

  it('should allow project creation for OWNER (V2-10)', () => {
    setup({ role: 'OWNER' });

    expect(component.canCreate()).toBe(true);
  });

  it('should allow project creation for ADMIN (V2-10)', () => {
    setup({ role: 'ADMIN' });

    expect(component.canCreate()).toBe(true);
  });

  it('should hide the Create-project CTA from plain MEMBERs (V2-10)', () => {
    setup({ role: 'MEMBER' });

    expect(component.canCreate()).toBe(false);
  });
});
