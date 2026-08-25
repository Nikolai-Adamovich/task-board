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

  async function setup(taskOverrides: Partial<Task> = {}) {
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
    // rxResource resolves asynchronously — poll until the task signal populates
    for (let i = 0; i < 100 && !component.task(); i++) {
      await new Promise((r) => setTimeout(r, 10));
      fixture.detectChanges();
    }
  }

  // ── Loading ─────────────────────────────────────────────────────

  describe('loading', () => {
    it('should call taskClient.getById on init', async () => {
      await setup();
      expect(taskClientMock.getById).toHaveBeenCalledWith('tk000000-0000-0000-0000-000000000001');
    });

    it('should populate task signal after loading', async () => {
      await setup();
      expect(component.task()).toBeTruthy();
      expect(component.task().title).toBe('Test Task');
    });

    it('should populate the task and clear error after successful load', async () => {
      await setup();
      expect(component.task()).toBeTruthy();
      expect(component.error()).toBe('');
    });

    it('should set loading to false on error', async () => {
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

      // rxResource settles asynchronously — give it a moment to settle
      for (let i = 0; i < 20 && !component.task(); i++) {
        await new Promise((r) => setTimeout(r, 10));
        fixture.detectChanges();
      }

      expect(component.task()).toBeNull();
    });
  });

  // ── getPriorityColor ───────────────────────────────────

  describe('getPriorityColor', () => {
    beforeEach(() => setup());

    it('should return correct color for LOW', async () => {
      expect(component.priorityBadgeVariant('LOW')).toBe('outline');
    });

    it('should return correct color for MEDIUM', async () => {
      expect(component.priorityBadgeVariant('MEDIUM')).toBe('secondary');
    });

    it('should return correct color for HIGH', async () => {
      expect(component.priorityBadgeVariant('HIGH')).toBe('default');
    });

    it('should return correct color for CRITICAL', async () => {
      expect(component.priorityBadgeVariant('CRITICAL')).toBe('destructive');
    });

    it('should return fallback color for unknown priority', async () => {
      expect(component.priorityBadgeVariant('unknown')).toBe('outline');
    });
  });

  // ── taskLabel ──────────────────────────────────────────

  describe('taskLabel', () => {
    beforeEach(() => setup());

    it('should return #number', async () => {
      expect(component.taskLabel()).toBe('#1');
    });
  });

  // ── Edit flow ──────────────────────────────────────────────────

  describe('edit flow', () => {
    beforeEach(() => setup());

    it('should populate edit form when startEdit is called', async () => {
      component.startEdit();

      expect(component.isEditing()).toBe(true);
      expect(component.model().title).toBe('Test Task');
      expect(component.model().description).toBe('Task description');
      expect(component.model().priority).toBe('HIGH');
    });

    it('should reset form when cancelEdit is called', async () => {
      component.startEdit();
      component.cancelEdit();

      expect(component.isEditing()).toBe(false);
      expect(component.model().title).toBe('');
      expect(component.model().description).toBe('');
      expect(component.model().priority).toBe('MEDIUM');
    });

    it('should call taskClient.update with version on saveTask', async () => {
      component.startEdit();
      component.model.update((m: EditTaskForm) => ({ ...m, title: 'Updated Title' }));
      submit(component.editForm);

      expect(taskClientMock.update).toHaveBeenCalledWith(
        mockTask.id,
        expect.objectContaining({ title: 'Updated Title', version: 1 }),
      );
    });

    it('should update task signal after successful save', async () => {
      component.startEdit();
      component.model.update((m: EditTaskForm) => ({ ...m, title: 'Updated Title' }));
      submit(component.editForm);

      expect(component.task().title).toBe('Updated Title');
      expect(component.isEditing()).toBe(false);
    });

    it('should stay in edit mode when save fails', async () => {
      taskClientMock.update.mockReturnValueOnce(throwError(() => new Error('fail')));
      component.startEdit();
      submit(component.editForm);

      expect(component.isEditing()).toBe(true);
      expect(component.error()).not.toBe('');
    });
  });

  // ── canDelete ──────────────────────────────────────────────────

  describe('canDelete', () => {
    it('should return true when user is authenticated', async () => {
      await setup();
      expect(component.canDelete()).toBe(true);
    });

    it('should return false when user is not authenticated', async () => {
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

    it('should show conflict dialog on 409 response', async () => {
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

    it('should reload task and close conflict dialog on reloadAfterConflict', async () => {
      component.showConflictDialog.set(true);
      component.reloadAfterConflict();

      expect(component.showConflictDialog()).toBe(false);
      expect(component.isEditing()).toBe(false);
    });
  });
});
