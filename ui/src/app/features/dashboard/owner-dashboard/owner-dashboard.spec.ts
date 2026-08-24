/**
 * Tests for the OwnerDashboard component.
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
import { TranslocoTestingModule } from '@jsverse/transloco';
import { OwnerDashboard } from './owner-dashboard';
import { API_BASE_URL } from '@app/api-url.token';
import { NeutralColor } from '@app/constants/priority';
import type { MyTask } from '@app/types/frontend';

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
    priority: 'HIGH',
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
    priority: 'LOW',
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
    priority: 'CRITICAL',
    sprintId: null,
    createdAt: NOW,
    updatedAt: NOW,
  },
];

describe('OwnerDashboard', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let component: any;

  function setup(taskOverrides: MyTask[] = mockTasks) {
    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { en: {} } })],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: 'http://localhost/api' },
      ],
    });

    const fixture = TestBed.createComponent(OwnerDashboard);

    fixture.componentRef.setInput('tasks', taskOverrides);
    fixture.componentRef.setInput('tenants', []);

    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  // ── getPriorityColor ───────────────────────────────────────────────────

  describe('getPriorityColor', () => {
    beforeEach(() => setup());

    it('should return correct color for CRITICAL', () => {
      expect(component.priorityBadgeClass('CRITICAL')).toBe('bg-red-100 text-red-700');
    });

    it('should return correct color for HIGH', () => {
      expect(component.priorityBadgeClass('HIGH')).toBe('bg-orange-100 text-orange-700');
    });

    it('should return correct color for MEDIUM', () => {
      expect(component.priorityBadgeClass('MEDIUM')).toBe('bg-yellow-100 text-yellow-700');
    });

    it('should return correct color for LOW', () => {
      expect(component.priorityBadgeClass('LOW')).toBe('bg-blue-100 text-blue-700');
    });

    it('should return fallback for unknown priority', () => {
      expect(component.priorityBadgeClass('unknown')).toBe(NeutralColor);
    });
  });
});
