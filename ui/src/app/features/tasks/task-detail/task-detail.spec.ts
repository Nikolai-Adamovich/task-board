/**
 * Tests for the TaskDetail component.
 *
 * Covers:
 * - Loading task on init
 * - Loading/error states
 * - getPriorityColor helper
 * - startEdit / cancelEdit toggle
 * - saveTask submission
 * - canDelete check
 * - optimistic concurrency conflict handling
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import { submit } from '@angular/forms/signals';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { TaskDetail, EditTaskForm } from './task-detail';
import { TaskClient } from '@services/task-client';
import { AuthStore } from '@stores/auth-store';
import { API_BASE_URL } from '@app/api-url.token';
import { NeutralColor } from '@app/constants/priority';
import { HttpErrorResponse } from '@angular/common/http';
import type { Task, User } from '@task-board/shared';

const NOW = '2025-01-01T00:00:00Z';
const mockTask: Task = {
  id: 'tk000000-0000-0000-0000-000000000001',
  projectId: 'p0000000-0000-0000-0000-000000000001',
  number: 1,
  typeId: 'type1',
  title: 'Test Task',
  description: 'Task description',
  statusId: 's1',
  priority: 'HIGH',
  reporterId: 'u1',
  reporterSnapshot: { displayName: 'Reporter User' },
  assigneeId: 'u2',
  assigneeSnapshot: { displayName: 'Assignee User' },
  sprintId: null,
  labelIds: ['label1'],
  createdById: 'u1',
  createdBySnapshot: { displayName: 'Creator User' },
  version: 1,
  createdAt: NOW,
  updatedAt: NOW,
};

describe('TaskDetail', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let component: any;
  let taskClientMock: {
    getById: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let authStoreMock: { currentUser: ReturnType<typeof vi.fn>; tenantRole: ReturnType<typeof vi.fn> };

  function setup(taskOverrides: Partial<Task> = {}) {
    const task = { ...mockTask, ...taskOverrides };

    taskClientMock = {
      getById: vi.fn().mockReturnValue(of(task)),
      update: vi.fn().mockReturnValue(of({ ...task, title: 'Updated Title', version: 2 })),
      delete: vi.fn().mockReturnValue(of(undefined)),
    };
    authStoreMock = {
      currentUser: vi.fn().mockReturnValue({ id: 'u1', email: 'a@b.com', displayName: 'Test' } as User),
      tenantRole: vi.fn().mockReturnValue('OWNER'),
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
        { provide: TaskClient, useValue: taskClientMock },
        { provide: AuthStore, useValue: authStoreMock },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: () => 't1' } },
            parent: { snapshot: { paramMap: { get: () => 't1' } }, parent: null },
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(TaskDetail);

    fixture.componentRef.setInput('taskId', 'tk000000-0000-0000-0000-000000000001');

    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  // ── Loading ─────────────────────────────────────────────────────

  describe('loading', () => {
    it('should call taskClient.getById on init', () => {
      setup();
      expect(taskClientMock.getById).toHaveBeenCalledWith('tk000000-0000-0000-0000-000000000001');
    });

    it('should populate task signal after loading', () => {
      setup();
      expect(component.task()).toBeTruthy();
      expect(component.task().title).toBe('Test Task');
    });

    it('should set loading to false after successful load', () => {
      setup();
      expect(component.loading()).toBe(false);
    });

    it('should set loading to false on error', () => {
      taskClientMock = {
        getById: vi.fn().mockReturnValue(throwError(() => new Error('fail'))),
        update: vi.fn(),
        delete: vi.fn(),
      };
      authStoreMock = {
        currentUser: vi.fn().mockReturnValue(null),
        tenantRole: vi.fn().mockReturnValue(null),
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
          { provide: TaskClient, useValue: taskClientMock },
          { provide: AuthStore, useValue: authStoreMock },
          {
            provide: ActivatedRoute,
            useValue: {
              snapshot: { paramMap: { get: () => 't1' } },
              parent: { snapshot: { paramMap: { get: () => 't1' } }, parent: null },
            },
          },
        ],
      });

      const fixture = TestBed.createComponent(TaskDetail);

      fixture.componentRef.setInput('taskId', 'tk000000-0000-0000-0000-000000000001');
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component.loading()).toBe(false);
      expect(component.task()).toBeNull();
    });
  });

  // ── getPriorityColor ───────────────────────────────────

  describe('getPriorityColor', () => {
    beforeEach(() => setup());

    it('should return correct color for LOW', () => {
      expect(component.priorityBadgeClass('LOW')).toBe('bg-blue-100 text-blue-700');
    });

    it('should return correct color for MEDIUM', () => {
      expect(component.priorityBadgeClass('MEDIUM')).toBe('bg-yellow-100 text-yellow-700');
    });

    it('should return correct color for HIGH', () => {
      expect(component.priorityBadgeClass('HIGH')).toBe('bg-orange-100 text-orange-700');
    });

    it('should return correct color for CRITICAL', () => {
      expect(component.priorityBadgeClass('CRITICAL')).toBe('bg-red-100 text-red-700');
    });

    it('should return fallback color for unknown priority', () => {
      expect(component.priorityBadgeClass('unknown')).toBe(NeutralColor);
    });
  });

  // ── taskLabel ──────────────────────────────────────────

  describe('taskLabel', () => {
    beforeEach(() => setup());

    it('should return #number', () => {
      expect(component.taskLabel()).toBe('#1');
    });
  });

  // ── Edit flow ──────────────────────────────────────────────────

  describe('edit flow', () => {
    beforeEach(() => setup());

    it('should populate edit form when startEdit is called', () => {
      component.startEdit();

      expect(component.isEditing()).toBe(true);
      expect(component.model().title).toBe('Test Task');
      expect(component.model().description).toBe('Task description');
      expect(component.model().priority).toBe('HIGH');
    });

    it('should reset form when cancelEdit is called', () => {
      component.startEdit();
      component.cancelEdit();

      expect(component.isEditing()).toBe(false);
      expect(component.model().title).toBe('');
      expect(component.model().description).toBe('');
      expect(component.model().priority).toBe('MEDIUM');
    });

    it('should call taskClient.update with version on saveTask', () => {
      component.startEdit();
      component.model.update((m: EditTaskForm) => ({ ...m, title: 'Updated Title' }));
      submit(component.editForm);

      expect(taskClientMock.update).toHaveBeenCalledWith(
        mockTask.id,
        expect.objectContaining({ title: 'Updated Title', version: 1 }),
      );
    });

    it('should update task signal after successful save', () => {
      component.startEdit();
      component.model.update((m: EditTaskForm) => ({ ...m, title: 'Updated Title' }));
      submit(component.editForm);

      expect(component.task().title).toBe('Updated Title');
      expect(component.isEditing()).toBe(false);
      expect(component.loading()).toBe(false);
    });

    it('should set saving to false on error', () => {
      taskClientMock.update.mockReturnValueOnce(throwError(() => new Error('fail')));
      component.startEdit();
      submit(component.editForm);

      expect(component.loading()).toBe(false);
    });
  });

  // ── canDelete ──────────────────────────────────────────────────

  describe('canDelete', () => {
    it('should return true when user is authenticated', () => {
      setup();
      expect(component.canDelete()).toBe(true);
    });

    it('should return false when user is not authenticated', () => {
      authStoreMock = {
        currentUser: vi.fn().mockReturnValue(null),
        tenantRole: vi.fn().mockReturnValue(null),
      };
      taskClientMock = {
        getById: vi.fn().mockReturnValue(of(mockTask)),
        update: vi.fn(),
        delete: vi.fn(),
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
          { provide: TaskClient, useValue: taskClientMock },
          { provide: AuthStore, useValue: authStoreMock },
          {
            provide: ActivatedRoute,
            useValue: {
              snapshot: { paramMap: { get: () => 't1' } },
              parent: { snapshot: { paramMap: { get: () => 't1' } }, parent: null },
            },
          },
        ],
      });

      const fixture = TestBed.createComponent(TaskDetail);

      fixture.componentRef.setInput('taskId', 'tk000000-0000-0000-0000-000000000001');
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component.canDelete()).toBe(false);
    });
  });

  // ── Optimistic concurrency ────────────────────────────────────

  describe('optimistic concurrency', () => {
    beforeEach(() => setup());

    it('should show conflict dialog on 409 response', () => {
      const conflictError = new HttpErrorResponse({
        status: 409,
        error: { error: { code: 'TASK_VERSION_CONFLICT', message: 'Version conflict' } },
      });

      taskClientMock.update.mockReturnValueOnce(throwError(() => conflictError));
      component.startEdit();
      component.model.update((m: EditTaskForm) => ({ ...m, title: 'Updated Title' }));
      submit(component.editForm);

      expect(component.showConflictDialog()).toBe(true);
      expect(component.conflictMessage()).toBe('taskDetail.conflictHint');
    });

    it('should reload task and close conflict dialog on reloadAfterConflict', () => {
      component.showConflictDialog.set(true);
      component.reloadAfterConflict();

      expect(component.showConflictDialog()).toBe(false);
      expect(component.isEditing()).toBe(false);
    });
  });
});
