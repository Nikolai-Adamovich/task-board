/**
 * Tests for the ProjectDetail overview (spec S9, DEC-034).
 *
 * Covers:
 * - Loading project/boards/sprints/statuses/tasks resources
 * - Active-sprint computed
 * - Status-count computation from per-status totals
 * - Recent-tasks selection
 * - Read-only banner keys for archived / deletion-pending projects
 * - isAdmin computed signal
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { ProjectDetail } from './project-detail';
import { ProjectClient } from '@services/project-client';
import { BoardClient } from '@services/board-client';
import { SprintClient } from '@services/sprint-client';
import { StatusClient } from '@services/status-client';
import { TaskClient } from '@services/task-client';
import { AuthStore } from '@stores/auth-store';
import { ProjectStore } from '@stores/project-store';
import { PreferencesStore } from '@stores/preferences-store';
import { TenantStore } from '@stores/tenant-store';
import { API_BASE_URL } from '@app/api-url.token';
import type { Project, Board, Sprint, Status, Task } from '@task-board/shared';

const NOW = '2025-01-01T00:00:00Z';
const mockProject: Project = {
  id: 'p0000000-0000-0000-0000-000000000001',
  tenantId: 't0000000-0000-0000-0000-000000000001',
  key: 'TP',
  name: 'Test Project',
  description: 'A project for testing',
  status: 'ACTIVE',
  defaultStatusId: 's1',
  defaultBoardId: 'b1',
  archiveReason: null,
  deletionScheduledAt: null,
  createdAt: NOW,
  updatedAt: NOW,
};
const mockBoards: Board[] = [
  { id: 'b1', projectId: mockProject.id, name: 'Board 1', type: 'KANBAN', columns: [], createdAt: NOW, updatedAt: NOW },
  { id: 'b2', projectId: mockProject.id, name: 'Board 2', type: 'SPRINT', columns: [], createdAt: NOW, updatedAt: NOW },
];
const mockSprints: Sprint[] = [
  {
    id: 'sp1',
    projectId: mockProject.id,
    name: 'Sprint 1',
    status: 'ACTIVE',
    startDate: '2025-01-01',
    endDate: '2025-01-14',
    createdAt: NOW,
    updatedAt: NOW,
  },
];
const mockStatuses: Status[] = [
  {
    id: 's1',
    projectId: mockProject.id,
    name: 'TODO',
    normalizedName: 'todo',
    position: 0,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 's2',
    projectId: mockProject.id,
    name: 'DONE',
    normalizedName: 'done',
    position: 1,
    createdAt: NOW,
    updatedAt: NOW,
  },
];

function makeTask(number_: number): Task {
  return {
    id: `task-${number_}`,
    projectId: mockProject.id,
    number: number_,
    typeId: 't1',
    title: `Task ${number_}`,
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
    createdBySnapshot: { displayName: 'User One' },
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

const mockRecentTasks = [makeTask(3), makeTask(2), makeTask(1)];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let component: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let fixture: any;
let projectClientMock: Record<string, ReturnType<typeof vi.fn>>;
let boardClientMock: Record<string, ReturnType<typeof vi.fn>>;
let sprintClientMock: Record<string, ReturnType<typeof vi.fn>>;
let statusClientMock: Record<string, ReturnType<typeof vi.fn>>;
let taskClientMock: Record<string, ReturnType<typeof vi.fn>>;

function paginated(data: unknown[], total = data.length) {
  return of({ data, pagination: { page: 1, limit: 30, total, totalPages: 1 } });
}

/** Poll until the condition holds (async resources resolve on microtasks/timers) */
async function until(condition: () => boolean): Promise<void> {
  for (let i = 0; i < 200 && !condition(); i++) {
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  fixture.detectChanges();
}

function setup(options: { tenantRole?: string; projectStatus?: Project['status'] } = {}) {
  const project = options.projectStatus ? { ...mockProject, status: options.projectStatus } : mockProject;

  projectClientMock = { getById: vi.fn().mockReturnValue(of(project)) };
  boardClientMock = { list: vi.fn().mockReturnValue(of(mockBoards)) };
  sprintClientMock = { list: vi.fn().mockReturnValue(of(mockSprints)) };
  statusClientMock = { list: vi.fn().mockReturnValue(of(mockStatuses)) };
  taskClientMock = {
    list: vi.fn((_projectId: string, query: Record<string, unknown> = {}) => {
      if (query.statusId === 's1') return paginated([], 5);
      if (query.statusId === 's2') return paginated([], 2);
      if (query.limit === 5) return paginated(mockRecentTasks);

      return paginated([]);
    }),
  };

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [TranslocoTestingModule.forRoot({ langs: { en: {} } })],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: API_BASE_URL, useValue: 'http://localhost/api' },
      { provide: ProjectClient, useValue: projectClientMock },
      { provide: BoardClient, useValue: boardClientMock },
      { provide: SprintClient, useValue: sprintClientMock },
      { provide: StatusClient, useValue: statusClientMock },
      { provide: TaskClient, useValue: taskClientMock },
      { provide: AuthStore, useValue: { tenantRole: vi.fn().mockReturnValue(options.tenantRole ?? 'OWNER') } },
      // R3-P8: format tokens consumed by recent tasks / sprint dates
      {
        provide: PreferencesStore,
        useValue: {
          datePipeFormat: () => 'yyyy-MM-dd',
          dateTimePipeFormat: () => 'yyyy-MM-dd HH:mm',
          // P12 (item 28): active language used as the DatePipe locale
          language: () => 'en',
        },
      },
      {
        provide: ProjectStore,
        useValue: {
          activeProject: vi.fn().mockReturnValue(project),
          projectRole: vi.fn().mockReturnValue(null),
          members: vi.fn().mockReturnValue([
            { userId: 'u1', role: 'PROJECT_ADMIN', displayName: 'Ada Lovelace' },
            { userId: 'u2', role: 'EDITOR', email: 'bob@example.com' },
          ]),
        },
      },
      { provide: TenantStore, useValue: { activeTenant: vi.fn().mockReturnValue({ slug: 'ws' }) } },
    ],
  });

  fixture = TestBed.createComponent(ProjectDetail);
  fixture.componentRef.setInput('projectKey', mockProject.key);
  component = fixture.componentInstance;
  fixture.detectChanges();
}

describe('ProjectDetail (overview)', () => {
  it('should load the project and boards', async () => {
    setup();
    await until(() => component.project() !== null);

    expect(projectClientMock.getById).toHaveBeenCalledWith(mockProject.id);
    expect(component.project()?.name).toBe('Test Project');
    expect(boardClientMock.list).toHaveBeenCalledWith(mockProject.id);
    expect(component.boards()).toHaveLength(2);
  });

  it('should expose the ACTIVE sprint', async () => {
    setup();
    await until(() => component.activeSprint() !== null);

    expect(sprintClientMock.list).toHaveBeenCalledWith(mockProject.id);
    expect(component.activeSprint()?.name).toBe('Sprint 1');
  });

  it('should compute per-status totals from pagination.total', async () => {
    setup();
    await until(() => component.statusCounts().length > 0);

    expect(component.statusCounts()).toEqual([
      { status: mockStatuses[0], total: 5 },
      { status: mockStatuses[1], total: 2 },
    ]);
    expect(component.totalTasks()).toBe(7);
  });

  it('should load recent tasks sorted by updatedAt desc', async () => {
    setup();
    await until(() => component.recentTasks().length > 0);

    expect(taskClientMock.list).toHaveBeenCalledWith(mockProject.id, { limit: 5, sort: 'updatedAt:desc' });
    expect(component.recentTasks()).toEqual(mockRecentTasks);
  });

  it('should show a read-only banner for archived projects', async () => {
    setup({ projectStatus: 'ARCHIVED' });
    await until(() => component.project() !== null);

    expect(component.readOnlyBannerKey()).toBe('projectDetail.archivedBanner');
  });

  it('should show a read-only banner for deletion-pending projects', async () => {
    setup({ projectStatus: 'DELETION_PENDING' });
    await until(() => component.project() !== null);

    expect(component.readOnlyBannerKey()).toBe('projectDetail.deletionPendingBanner');
  });

  it('should not show a banner for active projects', async () => {
    setup();
    await until(() => component.project() !== null);

    expect(component.readOnlyBannerKey()).toBe('');
  });

  describe('isAdmin', () => {
    it('should be true for tenant OWNER', async () => {
      setup({ tenantRole: 'OWNER' });
      await until(() => component.project() !== null);

      expect(component.isAdmin()).toBe(true);
    });

    it('should be false for tenant MEMBER without project role', async () => {
      setup({ tenantRole: 'MEMBER' });
      await until(() => component.project() !== null);

      expect(component.isAdmin()).toBe(false);
    });
  });

  it('should build member initials from display name or email', async () => {
    setup();
    await until(() => component.project() !== null);

    expect(component.memberInitials('Ada Lovelace', undefined)).toBe('AL');
    expect(component.memberInitials(undefined, 'bob@example.com')).toBe('BO');
    expect(component.memberInitials(undefined, undefined)).toBe('?');
  });

  // ── Round 5: equal-height overview cards ─────────────────────

  it('should render equal-height overview cards (items-stretch grid + h-full cards)', async () => {
    setup();
    await until(() => component.project() !== null);

    const el: HTMLElement = fixture.nativeElement;
    const grid = el.querySelector('div.grid.items-stretch');

    expect(grid).not.toBeNull();

    const cards = el.querySelectorAll('hlm-card');

    expect(cards.length).toBe(4);
    cards.forEach((card) => expect(card.classList.contains('h-full')).toBe(true));
  });
});
