/**
 * Tests for the FilterPanel component.
 *
 * Covers:
 * - Loading filters on init
 * - Saving current filter criteria
 * - Applying a saved filter (output emission)
 * - Deleting a filter with confirmation
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { FilterPanel } from './filter-panel';
import { FilterClient } from '@services/filter-client';
import { API_BASE_URL } from '@app/api-url.token';
import type { Filter, FilterCriteria } from '@task-board/shared';

const NOW = '2025-01-01T00:00:00Z';
const mockFilters: Filter[] = [
  {
    id: 'f1',
    projectId: 'p1',
    userId: 'u1',
    name: 'My High Priority',
    filters: { priority: ['HIGH', 'CRITICAL'] },
    sort: { field: 'priority', direction: 'desc' },
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'f2',
    projectId: 'p1',
    userId: 'u1',
    name: 'Open Bugs',
    filters: { search: 'bug', statusIds: ['s1'] },
    sort: { field: 'createdAt', direction: 'asc' },
    createdAt: NOW,
    updatedAt: NOW,
  },
];

describe('FilterPanel', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let component: any;
  let filterClientMock: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let emittedCriteria: FilterCriteria | undefined;

  function setup(filters: Filter[] = mockFilters) {
    emittedCriteria = undefined;

    filterClientMock = {
      list: vi.fn().mockReturnValue(of(filters)),
      create: vi.fn().mockReturnValue(
        of({
          id: 'f3',
          projectId: 'p1',
          userId: 'u1',
          name: 'New Filter',
          filters: { search: 'test' },
          sort: { field: 'createdAt', direction: 'desc' },
          createdAt: NOW,
          updatedAt: NOW,
        }),
      ),
      delete: vi.fn().mockReturnValue(of({ success: true })),
    };

    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { en: {} } })],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: 'http://localhost/api' },
        { provide: FilterClient, useValue: filterClientMock },
      ],
    });

    const fixture = TestBed.createComponent(FilterPanel);

    fixture.componentRef.setInput('projectId', 'p1');
    fixture.componentRef.setInput('currentFilters', { search: 'test' });
    fixture.componentRef.setInput('currentSort', { field: 'createdAt', direction: 'desc' });

    component = fixture.componentInstance;
    component.filterApplied.subscribe((criteria: FilterCriteria) => {
      emittedCriteria = criteria;
    });
    fixture.detectChanges();
  }

  // ── Loading ─────────────────────────────────────────────────────
  it('should load filters on init', () => {
    setup();
    expect(filterClientMock.list).toHaveBeenCalledWith('p1');
    expect(component.filters()).toHaveLength(2);
    expect(component.loading()).toBe(false);
  });

  it('should handle load error', () => {
    filterClientMock = {
      list: vi.fn().mockReturnValue(throwError(() => new Error('fail'))),
      create: vi.fn(),
      delete: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { en: {} } })],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: 'http://localhost/api' },
        { provide: FilterClient, useValue: filterClientMock },
      ],
    });

    const fixture = TestBed.createComponent(FilterPanel);

    fixture.componentRef.setInput('projectId', 'p1');
    fixture.componentRef.setInput('currentFilters', {});
    fixture.componentRef.setInput('currentSort', { field: 'createdAt', direction: 'desc' });

    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.error()).toBe('filters.loadError');
  });

  // ── Save ────────────────────────────────────────────────────────
  it('should save current filter criteria', () => {
    setup();
    component.filterName.set('New Filter');
    component.saveFilter();
    expect(filterClientMock.create).toHaveBeenCalledWith('p1', {
      name: 'New Filter',
      filters: { search: 'test' },
      sort: { field: 'createdAt', direction: 'desc' },
    });
    expect(component.filters()).toHaveLength(3);
    expect(component.showSaveForm()).toBe(false);
  });

  it('should not save with empty name', () => {
    setup();
    component.filterName.set('   ');
    component.saveFilter();
    expect(filterClientMock.create).not.toHaveBeenCalled();
  });

  // ── Apply ───────────────────────────────────────────────────────
  it('should emit filterApplied when applying a filter', () => {
    setup();

    const filter = component.filters()[0];

    component.applyFilter(filter);
    expect(emittedCriteria).toEqual({ priority: ['HIGH', 'CRITICAL'] });
  });

  // ── Delete ──────────────────────────────────────────────────────
  it('should confirm and delete a filter', () => {
    setup();

    const filter = component.filters()[0];

    component.confirmDelete(filter);
    expect(component.showDeleteConfirm()).toBe(true);
    expect(component.filterToDelete()?.id).toBe('f1');

    component.deleteFilter();
    expect(filterClientMock.delete).toHaveBeenCalledWith('f1');
    expect(component.filters()).toHaveLength(1);
    expect(component.showDeleteConfirm()).toBe(false);
  });
});
