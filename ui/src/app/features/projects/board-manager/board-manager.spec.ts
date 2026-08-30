/**
 * Tests for the BoardManager settings page (DEC-035).
 *
 * Covers:
 * - Listing boards
 * - Create board (v5 shape with type + empty columns)
 * - Rename board
 * - Delete guard for the default board (BR-023)
 * - Invalid status-column reference detection
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom, of, throwError } from 'rxjs';
import { submit } from '@angular/forms/signals';
import { TranslocoService, TranslocoTestingModule } from '@jsverse/transloco';
import { BoardManager } from './board-manager';
import { BoardClient } from '@services/board-client';
import { StatusClient } from '@services/status-client';
import { AuthStore } from '@stores/auth-store';
import { ProjectStore } from '@stores/project-store';
import { API_BASE_URL } from '@app/api-url.token';
import type { Project, Board, Status } from '@task-board/shared';
import { settle } from '@app/shared/testing/zoneless';

const NOW = '2025-01-01T00:00:00Z';
const mockProject: Project = {
  id: 'p0000000-0000-0000-0000-000000000001',
  tenantId: 't0000000-0000-0000-0000-000000000001',
  key: 'TP',
  name: 'Test Project',
  description: null,
  status: 'ACTIVE',
  defaultStatusId: 's1',
  defaultBoardId: 'b1',
  archiveReason: null,
  deletionScheduledAt: null,
  createdAt: NOW,
  updatedAt: NOW,
};

function makeBoard(id: string, name: string, columns: Board['columns'] = []): Board {
  return { id, projectId: mockProject.id, name, type: 'KANBAN', columns, createdAt: NOW, updatedAt: NOW };
}

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
];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let component: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let fixture: any;
let boardClientMock: Record<string, ReturnType<typeof vi.fn>>;

async function until(condition: () => boolean): Promise<void> {
  for (let i = 0; i < 200 && !condition(); i++) {
    await settle(fixture);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  await settle(fixture);
}

async function setup(boards: Board[] = [makeBoard('b1', 'Default'), makeBoard('b2', 'Sprint Board')]) {
  boardClientMock = {
    list: vi.fn().mockReturnValue(of(boards)),
    create: vi.fn().mockImplementation((_pid: string, data: { name: string }) => of(makeBoard('b3', data.name))),
    update: vi.fn().mockImplementation((id: string, data: { name: string }) => {
      const source = boards.find((b) => b.id === id) ?? boards[0];

      return of({ ...source, ...data });
    }),
    delete: vi.fn().mockReturnValue(of({ success: true })),
  };

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [TranslocoTestingModule.forRoot({ preloadLangs: true, langs: { en: {} } })],
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: API_BASE_URL, useValue: 'http://localhost/api' },
      { provide: BoardClient, useValue: boardClientMock },
      { provide: StatusClient, useValue: { list: vi.fn().mockReturnValue(of(mockStatuses)) } },
      { provide: AuthStore, useValue: { tenantRole: vi.fn().mockReturnValue('OWNER') } },
      {
        provide: ProjectStore,
        useValue: {
          activeProject: vi.fn().mockReturnValue(mockProject),
          projectRole: vi.fn().mockReturnValue(null),
        },
      },
    ],
  });
  await firstValueFrom(TestBed.inject(TranslocoService).load('en'));

  fixture = TestBed.createComponent(BoardManager);
  fixture.componentRef.setInput('projectKey', mockProject.key);
  component = fixture.componentInstance;
  await settle(fixture);
}

describe('BoardManager', () => {
  it('should load the board list', async () => {
    await setup();
    await until(() => component.boards().length > 0);

    expect(boardClientMock.list).toHaveBeenCalledWith(mockProject.id);
    expect(component.boards()).toHaveLength(2);
  });

  it('should create a board with empty columns and add it to the list', async () => {
    await setup();
    await until(() => component.boards().length > 0);

    component.createModel.update((m: { name: string; type: string }) => ({ ...m, name: 'New Board' }));
    submit(component.createBoardForm);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(boardClientMock.create).toHaveBeenCalledWith(mockProject.id, {
      name: 'New Board',
      type: 'KANBAN',
      columns: [
        { statusIds: [], position: 0 },
        { statusIds: [], position: 1 },
        { statusIds: [], position: 2 },
      ],
    });
    expect(component.boards()).toHaveLength(3);
    expect(component.showCreateDialog()).toBe(false);
  });

  it('should rename a board and update the list', async () => {
    await setup();
    await until(() => component.boards().length > 0);

    component.openRenameDialog(component.boards()[1]);
    component.renameModel.update((m: { name: string }) => ({ ...m, name: 'Renamed' }));
    submit(component.renameBoardForm);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(boardClientMock.update).toHaveBeenCalledWith('b2', { name: 'Renamed' });
    expect(component.boards()[1].name).toBe('Renamed');
    expect(component.renamingBoard()).toBeNull();
  });

  it('should refuse to delete the default board (BR-023)', async () => {
    await setup();
    await until(() => component.boards().length > 0);

    const defaultBoard = component.boards()[0];

    expect(component.isDefault(defaultBoard)).toBe(true);

    component.requestDelete(defaultBoard);

    expect(component.deletingBoard()).toBeNull();
    expect(boardClientMock.delete).not.toHaveBeenCalled();
  });

  it('should delete a non-default board after confirmation', async () => {
    await setup();
    await until(() => component.boards().length > 0);

    component.requestDelete(component.boards()[1]);
    component.confirmDelete();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(boardClientMock.delete).toHaveBeenCalledWith('b2');
    expect(component.boards()).toHaveLength(1);
  });

  it('should mark boards whose columns reference missing statuses', async () => {
    const stale = makeBoard('b2', 'Stale Board', [
      { id: 'c1', statusIds: ['s1'], position: 0 },
      { id: 'c2', statusIds: ['deleted-status'], position: 1 },
    ]);

    await setup([makeBoard('b1', 'Default'), stale]);
    await until(() => component.boards().length > 0);

    expect(component.hasInvalidRefs(component.boards()[0])).toBe(false);
    expect(component.hasInvalidRefs(component.boards()[1])).toBe(true);
  });

  it('should surface an error when delete fails', async () => {
    await setup();
    await until(() => component.boards().length > 0);

    boardClientMock.delete?.mockReturnValueOnce(throwError(() => new Error('boom')));
    component.requestDelete(component.boards()[1]);
    component.confirmDelete();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(component.error()).toBeTruthy();
    expect(component.deletingBoard()).toBeNull();
  });
});
