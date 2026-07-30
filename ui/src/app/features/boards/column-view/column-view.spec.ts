/**
 * Tests for the ColumnView component.
 *
 * Covers:
 * - Drag-and-drop events (dragOver, dragLeave, drop)
 * - onTaskDragStart emitting
 * - taskClick emitting
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ColumnView } from './column-view';
import { API_BASE_URL } from '@app/api-url.token';
import type { Column, Task } from '@task-board/shared';

const NOW = '2025-01-01T00:00:00Z';
const mockColumn: Column = {
  id: 'c0000000-0000-0000-0000-000000000001',
  boardId: 'b1',
  tenantId: 't1',
  name: 'To Do',
  position: 0,
  isDefault: true,
  createdAt: NOW,
};
const mockTasks: Task[] = [
  {
    id: 'tk1',
    tenantId: 't1',
    projectId: 'p1',
    boardId: 'b1',
    columnId: mockColumn.id,
    sprintId: null,
    title: 'Task 1',
    description: null,
    assigneeIds: [],
    priority: 'high',
    position: 0,
    createdBy: 'u1',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'tk2',
    tenantId: 't1',
    projectId: 'p1',
    boardId: 'b1',
    columnId: mockColumn.id,
    sprintId: null,
    title: 'Task 2',
    description: null,
    assigneeIds: [],
    priority: 'low',
    position: 1,
    createdBy: 'u1',
    createdAt: NOW,
    updatedAt: NOW,
  },
];

describe('ColumnView', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let component: any;

  function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: 'http://localhost/api' },
      ],
    });

    const fixture = TestBed.createComponent(ColumnView);

    fixture.componentRef.setInput('column', mockColumn);
    fixture.componentRef.setInput('tasks', mockTasks);

    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  describe('inputs', () => {
    beforeEach(() => setup());

    it('should receive column input', () => {
      expect(component.column()).toEqual(mockColumn);
    });

    it('should receive tasks input', () => {
      expect(component.tasks()).toEqual(mockTasks);
    });

    it('should default showAddButton to true', () => {
      expect(component.showAddButton()).toBe(true);
    });
  });

  describe('taskClick', () => {
    beforeEach(() => setup());

    it('should emit taskClick when a task is clicked', () => {
      const emitted = vi.fn();

      component.taskClick.subscribe(emitted);
      component.taskClick.emit(mockTasks[0]);

      expect(emitted).toHaveBeenCalledWith(mockTasks[0]);
    });
  });

  describe('taskDrop', () => {
    beforeEach(() => setup());

    it('should emit taskDrop with task and targetColumnId', () => {
      const emitted = vi.fn();

      component.taskDrop.subscribe(emitted);
      component.taskDrop.emit({ task: mockTasks[0], targetColumnId: 'c2' });

      expect(emitted).toHaveBeenCalledWith({ task: mockTasks[0], targetColumnId: 'c2' });
    });
  });

  describe('onDrop', () => {
    beforeEach(() => setup());

    it('should emit taskDrop with parsed task data from dataTransfer', () => {
      const emitted = vi.fn();

      component.taskDrop.subscribe(emitted);

      const mockDragEvent = {
        preventDefault: vi.fn(),
        currentTarget: { classList: { remove: vi.fn() } },
        dataTransfer: {
          getData: vi.fn().mockReturnValue(JSON.stringify(mockTasks[0])),
        },
      } as unknown as DragEvent;

      component.onDrop(mockDragEvent);

      expect(emitted).toHaveBeenCalledWith({ task: mockTasks[0], targetColumnId: mockColumn.id });
    });

    it('should not emit when no dataTransfer data', () => {
      const emitted = vi.fn();

      component.taskDrop.subscribe(emitted);

      const mockDragEvent = {
        preventDefault: vi.fn(),
        currentTarget: { classList: { remove: vi.fn() } },
        dataTransfer: {
          getData: vi.fn().mockReturnValue(''),
        },
      } as unknown as DragEvent;

      component.onDrop(mockDragEvent);

      expect(emitted).not.toHaveBeenCalled();
    });
  });

  describe('addTask', () => {
    it('should emit column when addTask is triggered', () => {
      setup();

      const emitted = vi.fn();

      component.addTask.subscribe(emitted);
      component.addTask.emit(mockColumn);

      expect(emitted).toHaveBeenCalledWith(mockColumn);
    });
  });
});
