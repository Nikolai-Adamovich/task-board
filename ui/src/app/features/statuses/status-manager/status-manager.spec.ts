/**
 * Tests for the StatusManager component.
 *
 * Covers:
 * - Loading statuses on init
 * - Create status validation & submission
 * - Inline rename (startEdit / saveEdit / cancelEdit)
 * - Reorder (moveUp / moveDown)
 * - Delete with replacement selector
 * - Dialog state changes
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom, of, throwError } from 'rxjs';
import { submit } from '@angular/forms/signals';
import { TranslocoService, TranslocoTestingModule } from '@jsverse/transloco';
import { StatusManager } from './status-manager';
import { StatusClient } from '@services/status-client';
import { ProjectStore } from '@stores/project-store';
import { AuthStore } from '@stores/auth-store';
import { API_BASE_URL } from '@app/api-url.token';
import type { Status } from '@task-board/shared';
import { settle } from '@app/shared/testing/zoneless';

const NOW = '2025-01-01T00:00:00Z';
const mockStatuses: Status[] = [
  { id: 's1', projectId: 'p1', name: 'TODO', normalizedName: 'todo', position: 0, createdAt: NOW, updatedAt: NOW },
  {
    id: 's2',
    projectId: 'p1',
    name: 'IN_PROGRESS',
    normalizedName: 'in_progress',
    position: 1,
    createdAt: NOW,
    updatedAt: NOW,
  },
  { id: 's3', projectId: 'p1', name: 'DONE', normalizedName: 'done', position: 2, createdAt: NOW, updatedAt: NOW },
];

describe('StatusManager', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let component: any;
  let statusClientMock: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    reorder: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  async function setup() {
    statusClientMock = {
      list: vi.fn().mockReturnValue(of([...mockStatuses])),
      reorder: vi.fn().mockImplementation((_pid: string, items: { id: string; position: number }[]) =>
        of(
          mockStatuses.map((s) => ({
            ...s,
            position: items.find((i) => i.id === s.id)?.position ?? s.position,
          })),
        ),
      ),
      create: vi.fn().mockImplementation((_pid: string, data: { name: string; position: number }) =>
        of({
          data: {
            id: 's4',
            projectId: 'p1',
            name: data.name,
            normalizedName: data.name.toLowerCase(),
            position: data.position,
            createdAt: NOW,
            updatedAt: NOW,
          },
        }),
      ),
      update: vi.fn().mockImplementation((id: string, data: { name?: string; position?: number }) => {
        const existing = mockStatuses.find((s) => s.id === id) ?? mockStatuses[0];

        return of({ ...existing, ...data, updatedAt: NOW });
      }),
      delete: vi.fn().mockReturnValue(of({ success: true })),
    };

    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ preloadLangs: true, langs: { en: {} } })],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: 'http://localhost/api' },
        {
          provide: AuthStore,
          useValue: {
            isAuthenticated: () => false,
            currentUser: () => null,
            token: () => null,
            tenantRole: () => null,
          },
        },
        { provide: StatusClient, useValue: statusClientMock },
        { provide: ProjectStore, useValue: { activeProject: () => ({ id: 'p1' }), projectRole: () => null } },
      ],
    });
    await firstValueFrom(TestBed.inject(TranslocoService).load('en'));

    const fixture = TestBed.createComponent(StatusManager);

    fixture.componentRef.setInput('projectKey', 'proj-key');

    component = fixture.componentInstance;
    await settle(fixture);
  }

  // ── Loading ─────────────────────────────────────────────

  describe('ngOnInit', () => {
    beforeEach(() => setup());

    it('should call statusClient.list with projectId', () => {
      expect(statusClientMock.list).toHaveBeenCalledWith('p1');
    });

    it('should populate statuses signal sorted by position', () => {
      expect(component.statuses()).toHaveLength(3);
      expect(component.statuses()[0].name).toBe('TODO');
    });

    it('should set loading to false', () => {
      expect(component.loading()).toBe(false);
    });

    it('should handle error on load', async () => {
      statusClientMock.list.mockReturnValueOnce(throwError(() => new Error('fail')));
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [TranslocoTestingModule.forRoot({ preloadLangs: true, langs: { en: {} } })],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([]),
          { provide: API_BASE_URL, useValue: 'http://localhost/api' },
          {
            provide: AuthStore,
            useValue: {
              isAuthenticated: () => false,
              currentUser: () => null,
              token: () => null,
              tenantRole: () => null,
            },
          },
          { provide: StatusClient, useValue: statusClientMock },
          { provide: ProjectStore, useValue: { activeProject: () => ({ id: 'p1' }), projectRole: () => null } },
        ],
      });
      await firstValueFrom(TestBed.inject(TranslocoService).load('en'));

      const fixture = TestBed.createComponent(StatusManager);

      fixture.componentRef.setInput('projectKey', 'proj-key');
      component = fixture.componentInstance;
      await settle(fixture);

      expect(component.loading()).toBe(false);
    });
  });

  // ── Create Status ────────────────────────────────────────

  describe('createForm', () => {
    beforeEach(() => setup());

    it('should not create when name is empty', () => {
      component.createForm();
      submit(component.createForm);
      expect(statusClientMock.create).not.toHaveBeenCalled();
    });

    it('should create status and add to list', () => {
      component.createModel.update(() => ({ name: 'NEW' }));
      submit(component.createForm);

      expect(statusClientMock.create).toHaveBeenCalledWith('p1', { name: 'NEW', position: 3 });
      expect(component.statuses()).toHaveLength(4);
      expect(component.showCreateDialog()).toBe(false);
    });
  });

  // ── Inline Edit ──────────────────────────────────────────

  describe('startEdit / saveEdit / cancelEdit', () => {
    beforeEach(() => setup());

    it('should enter edit mode', () => {
      component.startEdit(mockStatuses[0]);
      expect(component.editingId()).toBe('s1');
      expect(component.editingName()).toBe('TODO');
    });

    it('should cancel edit', () => {
      component.startEdit(mockStatuses[0]);
      component.cancelEdit();
      expect(component.editingId()).toBeNull();
      expect(component.editingName()).toBe('');
    });

    it('should save edit and update status', () => {
      component.startEdit(mockStatuses[0]);
      component.editingName.set('BACKLOG');
      component.saveEdit(mockStatuses[0]);

      expect(statusClientMock.update).toHaveBeenCalledWith('s1', { name: 'BACKLOG' });
      expect(component.editingId()).toBeNull();
    });

    it('should cancel if name unchanged', () => {
      component.startEdit(mockStatuses[0]);
      component.saveEdit(mockStatuses[0]);
      expect(statusClientMock.update).not.toHaveBeenCalled();
      expect(component.editingId()).toBeNull();
    });
  });

  // ── Reorder ──────────────────────────────────────────────

  describe('moveUp / moveDown', () => {
    beforeEach(() => setup());

    it('should not move first item up', () => {
      component.moveUp(mockStatuses[0]);
      expect(statusClientMock.update).not.toHaveBeenCalled();
    });

    it('should swap positions when moving up', () => {
      component.moveUp(mockStatuses[1]);
      expect(statusClientMock.reorder).toHaveBeenCalledTimes(1);
      expect(statusClientMock.reorder).toHaveBeenCalledWith('p1', [
        { id: mockStatuses[1]?.id, position: mockStatuses[0]?.position },
        { id: mockStatuses[0]?.id, position: mockStatuses[1]?.position },
      ]);
    });

    it('should not move last item down', () => {
      component.moveDown(mockStatuses[2]);
      expect(statusClientMock.reorder).not.toHaveBeenCalled();
    });

    it('should swap positions when moving down', () => {
      component.moveDown(mockStatuses[0]);
      expect(statusClientMock.reorder).toHaveBeenCalledTimes(1);
    });
  });

  // ── Delete ───────────────────────────────────────────────

  describe('confirmDelete / deleteStatus', () => {
    beforeEach(() => setup());

    it('should open delete dialog', () => {
      component.confirmDelete(mockStatuses[0]);
      expect(component.showDeleteDialog()).toBe(true);
      expect(component.deletingStatus()).toEqual(mockStatuses[0]);
    });

    it('should delete status without replacement', () => {
      component.confirmDelete(mockStatuses[0]);
      component.deleteStatus();

      expect(statusClientMock.delete).toHaveBeenCalledWith('s1', undefined);
      expect(component.statuses()).toHaveLength(2);
      expect(component.showDeleteDialog()).toBe(false);
    });

    it('should delete status with replacement', () => {
      component.confirmDelete(mockStatuses[0]);
      component.replacementStatusId.set('s2');
      component.deleteStatus();

      expect(statusClientMock.delete).toHaveBeenCalledWith('s1', 's2');
    });

    it('should compute otherStatuses excluding deleting one', () => {
      component.confirmDelete(mockStatuses[0]);
      expect(component.otherStatuses()).toHaveLength(2);
      expect(component.otherStatuses().find((s: Status) => s.id === 's1')).toBeUndefined();
    });

    it('should dismiss a stale error alert once a later mutation succeeds (V2-8)', () => {
      statusClientMock.delete.mockReturnValueOnce(throwError(() => new Error('STATUS_IN_USE')));

      component.confirmDelete(mockStatuses[0]);
      component.deleteStatus();

      expect(component.error()).not.toBe('');

      // Next attempt succeeds — the old alert must not survive the state change
      component.confirmDelete(mockStatuses[0]);
      component.deleteStatus();

      expect(component.error()).toBe('');
    });
  });

  // ── Dialog State Changes ─────────────────────────────────

  describe('dialog state changes', () => {
    beforeEach(() => setup());

    it('should close create dialog on closed state', () => {
      component.showCreateDialog.set(true);
      component.onDialogStateChange('closed');
      expect(component.showCreateDialog()).toBe(false);
    });

    it('should close delete dialog on closed state', () => {
      component.showDeleteDialog.set(true);
      component.onDeleteDialogStateChange('closed');
      expect(component.showDeleteDialog()).toBe(false);
      expect(component.deletingStatus()).toBeNull();
    });
  });
});
