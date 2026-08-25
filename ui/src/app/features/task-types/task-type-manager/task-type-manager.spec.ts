/**
 * Tests for the TaskTypeManager component.
 *
 * Covers:
 * - Loading task types on init
 * - Create task type validation & submission
 * - Inline rename / icon edit
 * - Reorder (moveUp / moveDown)
 * - Delete with replacement selector
 * - Dialog state changes
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { submit } from '@angular/forms/signals';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { TaskTypeManager } from './task-type-manager';
import { TaskTypeClient } from '@services/task-type-client';
import { ProjectStore } from '@stores/project-store';
import { AuthStore } from '@stores/auth-store';
import { API_BASE_URL } from '@app/api-url.token';
import type { TaskType } from '@task-board/shared';

const NOW = '2025-01-01T00:00:00Z';
const mockTaskTypes: TaskType[] = [
  { id: 'tt1', projectId: 'p1', key: 'TASK', name: 'Task', icon: '📋', position: 0, createdAt: NOW, updatedAt: NOW },
  { id: 'tt2', projectId: 'p1', key: 'BUG', name: 'Bug', icon: '🐛', position: 1, createdAt: NOW, updatedAt: NOW },
  { id: 'tt3', projectId: 'p1', key: 'STORY', name: 'Story', icon: '📖', position: 2, createdAt: NOW, updatedAt: NOW },
];

describe('TaskTypeManager', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let component: any;
  let taskTypeClientMock: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    reorder: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  function setup() {
    taskTypeClientMock = {
      list: vi.fn().mockReturnValue(of([...mockTaskTypes])),
      reorder: vi.fn().mockImplementation((_pid: string, items: { id: string; position: number }[]) =>
        of(
          mockTaskTypes.map((t) => ({
            ...t,
            position: items.find((i) => i.id === t.id)?.position ?? t.position,
          })),
        ),
      ),
      create: vi
        .fn()
        .mockImplementation((_pid: string, data: { key: string; name: string; icon: string; position: number }) =>
          of({
            data: {
              id: 'tt4',
              projectId: 'p1',
              key: data.key,
              name: data.name,
              icon: data.icon,
              position: data.position,
              createdAt: NOW,
              updatedAt: NOW,
            },
          }),
        ),
      update: vi.fn().mockImplementation((id: string, data: { name?: string; icon?: string; position?: number }) => {
        const existing = mockTaskTypes.find((t) => t.id === id) ?? mockTaskTypes[0];

        return of({ ...existing, ...data, updatedAt: NOW });
      }),
      delete: vi.fn().mockReturnValue(of({ success: true })),
    };

    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { en: {} } })],
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
        { provide: TaskTypeClient, useValue: taskTypeClientMock },
        { provide: ProjectStore, useValue: { activeProject: () => ({ id: 'p1' }), projectRole: () => null } },
      ],
    });

    const fixture = TestBed.createComponent(TaskTypeManager);

    fixture.componentRef.setInput('projectKey', 'proj-key');
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  // ── Loading ─────────────────────────────────────────────

  describe('ngOnInit', () => {
    beforeEach(() => setup());

    it('should call taskTypeClient.list with projectId', () => {
      expect(taskTypeClientMock.list).toHaveBeenCalledWith('p1');
    });

    it('should populate taskTypes signal sorted by position', () => {
      expect(component.taskTypes()).toHaveLength(3);
      expect(component.taskTypes()[0].key).toBe('TASK');
    });

    it('should set loading to false', () => {
      expect(component.loading()).toBe(false);
    });

    it('should handle error on load', () => {
      taskTypeClientMock.list.mockReturnValueOnce(throwError(() => new Error('fail')));
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [TranslocoTestingModule.forRoot({ langs: { en: {} } })],
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
          { provide: TaskTypeClient, useValue: taskTypeClientMock },
          { provide: ProjectStore, useValue: { activeProject: () => ({ id: 'p1' }), projectRole: () => null } },
        ],
      });

      const fixture = TestBed.createComponent(TaskTypeManager);

      fixture.componentRef.setInput('projectKey', 'proj-key');
      component = fixture.componentInstance;
      fixture.detectChanges();
      expect(component.loading()).toBe(false);
    });
  });

  // ── Create ──────────────────────────────────────────────

  describe('createForm', () => {
    beforeEach(() => setup());

    it('should not create when fields are empty', () => {
      submit(component.createForm);
      expect(taskTypeClientMock.create).not.toHaveBeenCalled();
    });

    it('should create task type and add to list', () => {
      component.createModel.update(() => ({ key: 'epic', name: 'Epic', icon: '🎯' }));
      submit(component.createForm);

      expect(taskTypeClientMock.create).toHaveBeenCalledWith('p1', {
        key: 'EPIC',
        name: 'Epic',
        icon: '🎯',
        position: 3,
      });
      expect(component.taskTypes()).toHaveLength(4);
      expect(component.showCreateDialog()).toBe(false);
    });
  });

  // ── Inline Edit ──────────────────────────────────────────

  describe('startEdit / saveEdit / cancelEdit', () => {
    beforeEach(() => setup());

    it('should enter edit mode with name and icon', () => {
      component.startEdit(mockTaskTypes[0]);
      expect(component.editingId()).toBe('tt1');
      expect(component.editingName()).toBe('Task');
      expect(component.editingIcon()).toBe('📋');
    });

    it('should cancel edit', () => {
      component.startEdit(mockTaskTypes[0]);
      component.cancelEdit();
      expect(component.editingId()).toBeNull();
    });

    it('should save name change', () => {
      component.startEdit(mockTaskTypes[0]);
      component.editingName.set('Work Item');
      component.saveEdit(mockTaskTypes[0]);

      expect(taskTypeClientMock.update).toHaveBeenCalledWith('tt1', { name: 'Work Item' });
      expect(component.editingId()).toBeNull();
    });

    it('should save icon change', () => {
      component.startEdit(mockTaskTypes[0]);
      component.editingIcon.set('📝');
      component.saveEdit(mockTaskTypes[0]);

      expect(taskTypeClientMock.update).toHaveBeenCalledWith('tt1', { icon: '📝' });
    });

    it('should cancel if nothing changed', () => {
      component.startEdit(mockTaskTypes[0]);
      component.saveEdit(mockTaskTypes[0]);
      expect(taskTypeClientMock.update).not.toHaveBeenCalled();
    });
  });

  // ── Reorder ──────────────────────────────────────────────

  describe('moveUp / moveDown', () => {
    beforeEach(() => setup());

    it('should not move first item up', () => {
      component.moveUp(mockTaskTypes[0]);
      expect(taskTypeClientMock.update).not.toHaveBeenCalled();
    });

    it('should swap positions when moving up', () => {
      component.moveUp(mockTaskTypes[1]);
      expect(taskTypeClientMock.reorder).toHaveBeenCalledTimes(1);
      expect(taskTypeClientMock.reorder).toHaveBeenCalledWith('p1', [
        { id: mockTaskTypes[1].id, position: mockTaskTypes[0].position },
        { id: mockTaskTypes[0].id, position: mockTaskTypes[1].position },
      ]);
    });

    it('should not move last item down', () => {
      component.moveDown(mockTaskTypes[2]);
      expect(taskTypeClientMock.reorder).not.toHaveBeenCalled();
    });
  });

  // ── Delete ───────────────────────────────────────────────

  describe('confirmDelete / deleteTaskType', () => {
    beforeEach(() => setup());

    it('should open delete dialog', () => {
      component.confirmDelete(mockTaskTypes[0]);
      expect(component.showDeleteDialog()).toBe(true);
      expect(component.deletingType()).toEqual(mockTaskTypes[0]);
    });

    it('should delete without replacement', () => {
      component.confirmDelete(mockTaskTypes[0]);
      component.deleteTaskType();

      expect(taskTypeClientMock.delete).toHaveBeenCalledWith('tt1', undefined);
      expect(component.taskTypes()).toHaveLength(2);
    });

    it('should delete with replacement', () => {
      component.confirmDelete(mockTaskTypes[0]);
      component.replacementTypeId.set('tt2');
      component.deleteTaskType();

      expect(taskTypeClientMock.delete).toHaveBeenCalledWith('tt1', 'tt2');
    });
  });

  // ── Dialog State Changes ─────────────────────────────────

  describe('dialog state changes', () => {
    beforeEach(() => setup());

    it('should close create dialog', () => {
      component.showCreateDialog.set(true);
      component.onDialogStateChange('closed');
      expect(component.showCreateDialog()).toBe(false);
    });

    it('should close delete dialog', () => {
      component.showDeleteDialog.set(true);
      component.onDeleteDialogStateChange('closed');
      expect(component.showDeleteDialog()).toBe(false);
      expect(component.deletingType()).toBeNull();
    });
  });
});
