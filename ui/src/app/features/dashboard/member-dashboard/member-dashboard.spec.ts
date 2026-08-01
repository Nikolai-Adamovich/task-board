/**
 * Tests for the MemberDashboard component.
 *
 * Covers:
 * - getPriorityColor helper
 * - inProgressCount computed getter
 * - Input defaults
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { MemberDashboard } from './member-dashboard';
import { API_BASE_URL } from '@app/api-url.token';
import { NeutralColor } from '@app/constants/priority';
import type { MyTask } from '@task-board/shared';

const NOW = '2025-01-01T00:00:00Z';
const mockTasks: MyTask[] = [
  {
    id: 't1',
    tenantId: 'ten1',
    tenantName: 'Acme',
    projectId: 'p1',
    projectName: 'Proj',
    boardId: 'b1',
    columnId: 'c1',
    columnTitle: 'In Progress',
    title: 'Task 1',
    description: null,
    priority: 'high',
    sprintId: null,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 't2',
    tenantId: 'ten1',
    tenantName: 'Acme',
    projectId: 'p1',
    projectName: 'Proj',
    boardId: 'b1',
    columnId: 'c2',
    columnTitle: 'To Do',
    title: 'Task 2',
    description: null,
    priority: 'low',
    sprintId: null,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 't3',
    tenantId: 'ten1',
    tenantName: 'Acme',
    projectId: 'p1',
    projectName: 'Proj',
    boardId: 'b1',
    columnId: 'c1',
    columnTitle: 'In Progress',
    title: 'Task 3',
    description: null,
    priority: 'critical',
    sprintId: null,
    createdAt: NOW,
    updatedAt: NOW,
  },
];

describe('MemberDashboard', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let component: any;

  function setup(taskOverrides: MyTask[] = mockTasks) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: 'http://localhost/api' },
      ],
    });

    const fixture = TestBed.createComponent(MemberDashboard);

    fixture.componentRef.setInput('tasks', taskOverrides);
    fixture.componentRef.setInput('tenants', []);

    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  // ── getPriorityColor ───────────────────────────────────────────────────

  describe('getPriorityColor', () => {
    beforeEach(() => setup());

    it('should return correct color for critical', () => {
      expect(component.getPriorityColor('critical')).toBe('bg-red-100 text-red-700');
    });

    it('should return correct color for high', () => {
      expect(component.getPriorityColor('high')).toBe('bg-orange-100 text-orange-700');
    });

    it('should return correct color for medium', () => {
      expect(component.getPriorityColor('medium')).toBe('bg-blue-100 text-blue-700');
    });

    it('should return correct color for low', () => {
      expect(component.getPriorityColor('low')).toBe('bg-blue-100 text-blue-700');
    });

    it('should return fallback for unknown priority', () => {
      expect(component.getPriorityColor('unknown')).toBe(NeutralColor);
    });
  });

  // ── inProgressCount ────────────────────────────────────────────────────

  describe('inProgressCount', () => {
    it('should count tasks with "progress" in columnTitle', () => {
      setup();
      expect(component.inProgressCount).toBe(2);
    });

    it('should be case-insensitive', () => {
      const tasks: MyTask[] = [
        { ...mockTasks[0], columnTitle: 'IN PROGRESS' },
        { ...mockTasks[1], columnTitle: 'todo' },
      ];

      setup(tasks);
      expect(component.inProgressCount).toBe(1);
    });

    it('should return 0 when no tasks match', () => {
      const tasks: MyTask[] = [
        { ...mockTasks[0], columnTitle: 'To Do' },
        { ...mockTasks[1], columnTitle: 'Done' },
      ];

      setup(tasks);
      expect(component.inProgressCount).toBe(0);
    });

    it('should return 0 for empty tasks', () => {
      setup([]);
      expect(component.inProgressCount).toBe(0);
    });
  });
});
