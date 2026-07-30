/**
 * Tests for the TaskCard component.
 *
 * Covers:
 * - priorityColor helper
 * - onDragStart emitting
 * - taskClick output
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TaskCard } from './task-card';
import { API_BASE_URL } from '@app/api-url.token';
import type { Task } from '@task-board/shared';

const NOW = '2025-01-01T00:00:00Z';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'tk1',
    tenantId: 't1',
    projectId: 'p1',
    boardId: 'b1',
    columnId: 'c1',
    sprintId: null,
    title: 'Test Task',
    description: null,
    assigneeIds: [],
    priority: 'medium',
    position: 0,
    createdBy: 'u1',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('TaskCard', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let component: any;

  function setup(taskOverrides: Partial<Task> = {}) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: 'http://localhost/api' },
      ],
    });

    const fixture = TestBed.createComponent(TaskCard);

    fixture.componentRef.setInput('task', makeTask(taskOverrides));

    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  // ── priorityColor ──────────────────────────────────────────────────────

  describe('priorityColor', () => {
    it('should return correct color for low', () => {
      setup({ priority: 'low' });
      expect(component.priorityColor()).toBe('bg-blue-100 text-blue-700');
    });

    it('should return correct color for medium', () => {
      setup({ priority: 'medium' });
      expect(component.priorityColor()).toBe('bg-yellow-100 text-yellow-700');
    });

    it('should return correct color for high', () => {
      setup({ priority: 'high' });
      expect(component.priorityColor()).toBe('bg-orange-100 text-orange-700');
    });

    it('should return correct color for critical', () => {
      setup({ priority: 'critical' });
      expect(component.priorityColor()).toBe('bg-red-100 text-red-700');
    });

    it('should return fallback for unknown priority', () => {
      setup({ priority: 'unknown' as Task['priority'] });
      expect(component.priorityColor()).toBe('bg-gray-100 text-gray-700');
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
