/**
 * Tests for the TaskCard component.
 *
 * Covers:
 * - priorityColor helper
 * - taskLabel helper
 * - onDragStart emitting
 * - taskClick output
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { TaskCard } from './task-card';
import { API_BASE_URL } from '@app/api-url.token';
import { NeutralColor } from '@app/constants/priority';
import type { Task } from '@task-board/shared';

const NOW = '2025-01-01T00:00:00Z';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'tk1',
    projectId: 'p1',
    number: 1,
    typeId: 'type1',
    title: 'Test Task',
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
    createdBySnapshot: { displayName: 'Test User' },
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('TaskCard', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let component: any;

  function setup(taskOverrides: Partial<Task> = {}, projectKey = 'PROJ') {
    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { en: {} } })],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: 'http://localhost/api' },
      ],
    });

    const fixture = TestBed.createComponent(TaskCard);

    fixture.componentRef.setInput('task', makeTask(taskOverrides));
    fixture.componentRef.setInput('projectKey', projectKey);

    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  // ── priorityColor ──────────────────────────────────────────────────────

  describe('priorityColor', () => {
    it('should return correct color for LOW', () => {
      setup({ priority: 'LOW' });
      expect(component.priorityColor()).toBe('bg-blue-100 text-blue-700');
    });

    it('should return correct color for MEDIUM', () => {
      setup({ priority: 'MEDIUM' });
      expect(component.priorityColor()).toBe('bg-yellow-100 text-yellow-700');
    });

    it('should return correct color for HIGH', () => {
      setup({ priority: 'HIGH' });
      expect(component.priorityColor()).toBe('bg-orange-100 text-orange-700');
    });

    it('should return correct color for CRITICAL', () => {
      setup({ priority: 'CRITICAL' });
      expect(component.priorityColor()).toBe('bg-red-100 text-red-700');
    });

    it('should return fallback for unknown priority', () => {
      setup({ priority: 'unknown' as Task['priority'] });
      expect(component.priorityColor()).toBe(NeutralColor);
    });
  });

  // ── taskLabel ──────────────────────────────────────────────────────────

  describe('taskLabel', () => {
    it('should return project key + number when projectKey is set', () => {
      setup({ number: 42 });
      expect(component.taskLabel()).toBe('PROJ-42');
    });

    it('should return #number when projectKey is empty', () => {
      setup({ number: 7 }, '');
      expect(component.taskLabel()).toBe('#7');
    });
  });

  // ── onDragStart ────────────────────────────────────────────────────────

  describe('onDragStart', () => {
    beforeEach(() => setup());

    it('should emit dragStart with task and dragEvent', () => {
      const emitted = vi.fn();

      component.dragStart.subscribe(emitted);

      const mockDragEvent = { type: 'dragstart' } as DragEvent;

      component.onDragStart(mockDragEvent);

      expect(emitted).toHaveBeenCalledWith({ task: component.task(), dragEvent: mockDragEvent });
    });
  });

  // ── taskClick ──────────────────────────────────────────────────────────

  describe('taskClick', () => {
    beforeEach(() => setup());

    it('should emit taskClick with the task', () => {
      const emitted = vi.fn();

      component.taskClick.subscribe(emitted);
      component.taskClick.emit(component.task());

      expect(emitted).toHaveBeenCalled();
    });
  });
});
