/**
 * Tests for the AuditLogViewer component.
 *
 * Covers:
 * - Loading events on init
 * - Filter by entity type
 * - Pagination controls
 * - Error handling
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { AuditLogViewer } from './audit-log-viewer';
import { AuditClient } from '@services/audit-client';
import { ProjectStore } from '@stores/project-store';
import { API_BASE_URL } from '@app/api-url.token';
import type { AuditEvent, PaginatedResponse } from '@task-board/shared';

const NOW = '2025-01-01T00:00:00Z';
const mockEvents: AuditEvent[] = [
  {
    id: 'ae1',
    tenantId: 't1',
    projectId: 'p1',
    entityType: 'TASK',
    entityId: 'task-1',
    action: 'CREATED',
    actor: { userId: 'u1', displayName: 'Alice' },
    changes: [{ field: 'title', oldValue: null, newValue: 'New Task' }],
    createdAt: NOW,
  },
  {
    id: 'ae2',
    tenantId: 't1',
    projectId: 'p1',
    entityType: 'SPRINT',
    entityId: 'sprint-1',
    action: 'UPDATED',
    actor: { userId: 'u2', displayName: 'Bob' },
    changes: [{ field: 'name', oldValue: 'Sprint 1', newValue: 'Sprint 1 Updated' }],
    createdAt: NOW,
  },
  {
    id: 'ae3',
    tenantId: 't1',
    projectId: 'p1',
    entityType: 'TASK',
    entityId: 'task-1',
    action: 'DELETED',
    actor: { userId: 'u1', displayName: 'Alice' },
    changes: [],
    createdAt: NOW,
  },
];
const mockPaginatedResponse: PaginatedResponse<AuditEvent> = {
  data: mockEvents,
  pagination: { page: 1, limit: 20, total: 3, totalPages: 1 },
};
const mockPaginatedPage2: PaginatedResponse<AuditEvent> = {
  data: [mockEvents[0]],
  pagination: { page: 2, limit: 20, total: 21, totalPages: 2 },
};

describe('AuditLogViewer', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let component: any;
  let auditClientMock: {
    listByProject: ReturnType<typeof vi.fn>;
  };

  function setup(listFn?: ReturnType<typeof vi.fn>) {
    auditClientMock = {
      listByProject: listFn ?? vi.fn().mockReturnValue(of(mockPaginatedResponse)),
    };

    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { en: {} } })],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: 'http://localhost/api' },
        { provide: AuditClient, useValue: auditClientMock },
        { provide: ProjectStore, useValue: { activeProject: () => ({ id: 'p1' }), projectRole: () => null } },
      ],
    });

    const fixture = TestBed.createComponent(AuditLogViewer);

    fixture.componentRef.setInput('projectKey', 'proj-key');
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  // ── Loading ─────────────────────────────────────────────

  describe('ngOnInit', () => {
    beforeEach(() => setup());

    it('should call auditClient.listByProject with projectId', () => {
      expect(auditClientMock.listByProject).toHaveBeenCalledWith('p1', 1, 20, undefined);
    });

    it('should populate events signal', () => {
      expect(component.events()).toHaveLength(3);
      expect(component.events()[0].actor.displayName).toBe('Alice');
    });

    it('should set loading to false', () => {
      expect(component.loading()).toBe(false);
    });

    it('should set pagination info', () => {
      expect(component.totalPages()).toBe(1);
      expect(component.total()).toBe(3);
    });
  });

  // ── Error handling ─────────────────────────────────────

  describe('error handling', () => {
    it('should set error on load failure', () => {
      setup(vi.fn().mockReturnValue(throwError(() => ({ error: { message: 'Forbidden' } }))));
      expect(component.error()).toBe('Forbidden');
      expect(component.loading()).toBe(false);
    });
  });

  // ── Filter ──────────────────────────────────────────────

  describe('onFilterChange', () => {
    beforeEach(() => setup());

    it('should update filter and reload with entity type', () => {
      auditClientMock.listByProject.mockClear();
      component.onFilterChange('TASK');

      expect(component.entityTypeFilter()).toBe('TASK');
      expect(component.page()).toBe(1);
      expect(auditClientMock.listByProject).toHaveBeenCalledWith('p1', 1, 20, 'TASK');
    });

    it('should clear filter when empty string selected', () => {
      component.onFilterChange('TASK');
      auditClientMock.listByProject.mockClear();
      component.onFilterChange('');

      expect(component.entityTypeFilter()).toBe('');
      expect(auditClientMock.listByProject).toHaveBeenCalledWith('p1', 1, 20, undefined);
    });
  });

  // ── Pagination ──────────────────────────────────────────

  describe('goToPage', () => {
    it('should navigate to next page', () => {
      setup(vi.fn().mockReturnValue(of(mockPaginatedPage2)));
      auditClientMock.listByProject.mockClear();

      component.goToPage(2);

      expect(component.page()).toBe(2);
      expect(auditClientMock.listByProject).toHaveBeenCalledWith('p1', 2, 20, undefined);
    });

    it('should not go below page 1', () => {
      setup();
      component.goToPage(0);
      expect(component.page()).toBe(1);
    });

    it('should not exceed total pages', () => {
      setup();
      component.goToPage(999);
      expect(component.page()).toBe(1);
    });
  });

  // ── Utility methods ─────────────────────────────────────

  describe('utility methods', () => {
    beforeEach(() => setup());

    it('should format date', () => {
      const result = component.formatDate(NOW);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return green variant for CREATED', () => {
      expect(component.getActionVariant('CREATED')).toContain('green');
    });

    it('should return blue variant for UPDATED', () => {
      expect(component.getActionVariant('UPDATED')).toContain('blue');
    });

    it('should return red variant for DELETED', () => {
      expect(component.getActionVariant('DELETED')).toContain('red');
    });

    it('should return empty string for unknown action', () => {
      expect(component.getActionVariant('UNKNOWN')).toBe('');
    });

    it('should truncate long IDs', () => {
      expect(component.truncateId('1234567890')).toBe('12345678\u2026');
    });

    it('should not truncate short IDs', () => {
      expect(component.truncateId('abc')).toBe('abc');
    });
  });
});
