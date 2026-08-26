/**
 * Tests for the TaskTable:
 *
 * - Debounced free-text search (~300 ms)
 * - Filtered-empty vs true-empty distinction
 * - Active-filter chips with per-chip removal + clear-all
 * - U3: fixed table layout, stable body height, Auto page-size
 */
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { of, Subject } from 'rxjs';
import { TranslocoTestingModule } from '@jsverse/transloco';
import {
  TaskTable,
  AUTO_PAGE_SIZE_SENTINEL,
  TASK_ROW_HEIGHT_PX,
  computeAutoPageSize,
  safeNumericParam,
} from './task-table';
import { TaskClient } from '@services/task-client';
import { FilterClient } from '@services/filter-client';
import { ProjectStore } from '@stores/project-store';
import { PreferencesStore } from '@stores/preferences-store';
import { ProjectRefStore } from '@stores/project-ref-store';
import { AuthStore } from '@stores/auth-store';
import { API_BASE_URL } from '@app/api-url.token';

describe('TaskTable — W9 polish', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let component: any;
  let fixture: ComponentFixture<TaskTable>;
  let taskClientMock: { list: ReturnType<typeof vi.fn> };
  let routerMock: { navigate: ReturnType<typeof vi.fn>; events: unknown };
  let routerEvents: Subject<NavigationEnd>;

  function setup(
    inputOverrides: Record<string, unknown> = {},
    storedPageSize = 30,
    tenantRole: string | null = 'OWNER',
    projectRole: string | null = null,
    storedColumns: string[] | null = null,
  ) {
    taskClientMock = {
      list: vi.fn().mockReturnValue(of({ data: [], pagination: { total: 0, page: 1, limit: 30, totalPages: 0 } })),
    };
    routerEvents = new Subject<NavigationEnd>();
    routerMock = { navigate: vi.fn().mockResolvedValue(true), events: routerEvents.asObservable() };

    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { en: {} } })],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: 'http://localhost/api' },
        { provide: TaskClient, useValue: taskClientMock },
        { provide: FilterClient, useValue: { list: vi.fn().mockReturnValue(of([])) } },
        {
          provide: ProjectStore,
          useValue: { activeProject: () => ({ id: 'p1', key: 'ABC' }), projectRole: () => projectRole },
        },
        { provide: AuthStore, useValue: { tenantRole: () => tenantRole } },
        {
          provide: PreferencesStore,
          useValue: {
            pageSize: () => storedPageSize,
            // R3-P8: format token consumed by the Created/Updated columns
            dateTimePipeFormat: () => 'yyyy-MM-dd HH:mm',
            setPageSize: vi.fn(),
            // R3-P4: per-project visible task-table columns (null = default set)
            getTaskTableColumns: vi.fn(() => storedColumns),
            setTaskTableColumns: vi.fn(),
            loadProjectPreferences: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ProjectRefStore,
          useValue: {
            ensure: vi.fn(),
            // One status so resolveNameToId can map the URL value to its id
            options: (_pid: string, kind: string) => (kind === 'statuses' ? [{ id: 'st1', name: 'To Do' }] : []),
            nameMap: (_pid: string, kind: string) => (kind === 'statuses' ? { st1: 'To Do' } : {}),
            nameOf: (_pid: string, kind: string, id: string) => (kind === 'statuses' && id === 'st1' ? 'To Do' : id),
          },
        },
        { provide: Router, useValue: routerMock },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: of({}),
            snapshot: { paramMap: { get: () => 'ABC' } },
            parent: { queryParams: of({}), snapshot: { paramMap: { get: () => 'acme' } }, parent: null },
          },
        },
      ],
    });

    fixture = TestBed.createComponent(TaskTable);

    fixture.componentRef.setInput('projectKey', 'ABC');
    Object.entries(inputOverrides).forEach(([key, value]) => {
      fixture.componentRef.setInput(key, value);
    });

    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  // ── Debounced search ───────────────────────────────────

  describe('debounced search', () => {
    beforeEach(() => setup());

    it('should not navigate immediately on keystroke', () => {
      vi.useFakeTimers();

      component.onSearch({ target: { value: 'foo' } });

      expect(routerMock.navigate).not.toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('should commit the search param after ~300 ms of inactivity', () => {
      vi.useFakeTimers();

      component.onSearch({ target: { value: 'foo' } });
      vi.advanceTimersByTime(300);

      expect(routerMock.navigate).toHaveBeenCalledWith(
        [],
        expect.objectContaining({
          queryParams: { search: 'foo', page: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        }),
      );
      vi.useRealTimers();
    });

    it('should only commit the last value when typing continues', () => {
      vi.useFakeTimers();

      component.onSearch({ target: { value: 'fo' } });
      vi.advanceTimersByTime(200);
      component.onSearch({ target: { value: 'foo' } });
      vi.advanceTimersByTime(300);

      const calls = routerMock.navigate.mock.calls as unknown[];

      expect(calls).toHaveLength(1);
      vi.useRealTimers();
    });

    it('should buffer keystrokes locally without touching the URL', () => {
      component.onSearch({ target: { value: 'bar' } });

      expect(component.searchInput()).toBe('bar');
      expect(routerMock.navigate).not.toHaveBeenCalled();
    });
  });

  // ── V4-7: no literal "undefined" in the search input ───

  describe('search input rendering (V4-7 regression)', () => {
    it('should render an empty search input when no ?search= param is present', () => {
      // Simulate withComponentInputBinding handing `undefined` for the absent param
      setup({ search: undefined });

      expect(component.searchInput()).toBe('');

      const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;

      expect(input.value).not.toContain('undefined');
      expect(input.value).toBe('');
    });

    it('should keep the buffered search text empty when the URL param is removed', () => {
      setup({ search: 'hello' });
      expect(component.searchInput()).toBe('hello');

      // Chip removal / back-navigation clears the param — router binds undefined
      fixture.componentRef.setInput('search', undefined);
      fixture.detectChanges();

      expect(component.searchInput()).toBe('');
    });
  });

  // ── V4-8: Title column width + clickable sort ──────────

  describe('title column header (V4-8 regression)', () => {
    it('should give the Title th an explicit percentage width with a min-width', () => {
      setup();

      const headers = fixture.nativeElement.querySelectorAll('thead th');
      const titleTh = headers[1] as HTMLElement; // second column = Title

      expect(titleTh.className).toContain('w-[30%]');
      expect(titleTh.className).toContain('min-w-[200px]');
    });

    it('should keep the fixed widths of non-title columns well below typical container widths', () => {
      setup();

      // V4-8 (reopened): if these sum ≥ available width, Title collapses to 0px.
      const pxWidths = component.taskColumns
        .filter((c: { field: string }) => c.field !== 'title')
        .map((c: { width?: string }) => Number.parseInt((c.width ?? '').match(/w-\[(\d+)px\]/)?.[1] ?? '0', 10));
      const sum = pxWidths.reduce((a: number, b: number) => a + b, 0);

      expect(pxWidths).toHaveLength(10); // every column except Title
      expect(pxWidths.every((w: number) => w > 0)).toBe(true);
      // Trimmed fixed widths (V4-8 reopened) — must stay well below the ~1232px
      // container of a 1280px viewport so Title keeps a usable share.
      expect(sum).toBe(1120);
    });

    it('should yield a Title column wider than 150px at a common desktop viewport (fixed-layout math)', () => {
      setup();

      // The unit-test DOM has no layout engine, so assert the CSS invariant the
      // classes encode: under `table-fixed`, when specified widths exceed the
      // table width each column keeps its proportional share — Title's 30% must
      // still clear 150px at a 1280px viewport (~1232px container after px-6).
      const container = 1280 - 48;
      const fixedSum = component.taskColumns
        .filter((c: { field: string }) => c.field !== 'title')
        .reduce(
          (acc: number, c: { width?: string }) =>
            acc + Number.parseInt((c.width ?? '').match(/w-\[(\d+)px\]/)?.[1] ?? '0', 10),
          0,
        );
      const titleSpecified = container * 0.3;
      const titleWidth = container * (titleSpecified / Math.max(fixedSum + titleSpecified, container));

      expect(fixedSum).toBeGreaterThan(0);
      expect(titleWidth).toBeGreaterThan(150);
    });

    it('should keep the Title sort button clickable by mouse', () => {
      setup();

      const headers = fixture.nativeElement.querySelectorAll('thead th');
      const titleTh = headers[1] as HTMLElement;
      const sortButton = titleTh.querySelector('button') as HTMLButtonElement;

      expect(sortButton).toBeTruthy();
      sortButton.click();
      fixture.detectChanges();

      expect(routerMock.navigate).toHaveBeenCalledWith(
        [],
        expect.objectContaining({ queryParams: { sort: 'title:asc', page: null } }),
      );
    });
  });

  // ── Empty-state distinction ────────────────────────────

  describe('empty states', () => {
    it('should report no active filters when the URL has none', () => {
      setup();

      expect(component.hasActiveFilters()).toBe(false);
    });

    it('should detect active filters and build a chip per filter', () => {
      setup({ search: 'hello', priority: 'HIGH' });

      expect(component.hasActiveFilters()).toBe(true);

      const chips = component.activeFilterChips();

      expect(chips).toEqual([
        { param: 'search', labelKey: 'taskTable.filterSearch', value: 'hello' },
        // R3-P5: priority chips show the title-case display label
        { param: 'priority', labelKey: 'taskTable.filterPriority', value: 'High' },
      ]);
    });

    it('should resolve reference-data names for filter chips', () => {
      setup({ status: 'To Do' });

      expect(component.activeFilterChips()).toEqual([
        { param: 'status', labelKey: 'taskTable.filterStatus', value: 'To Do' },
      ]);
    });
  });

  // ── Chip removal & clear-all ───────────────────────────

  describe('filter removal', () => {
    beforeEach(() => setup());

    it('should remove a single filter via its param', () => {
      component.removeFilter('priority');

      expect(routerMock.navigate).toHaveBeenCalledWith(
        [],
        expect.objectContaining({
          queryParams: { priority: null, page: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        }),
      );
    });

    it('should clear every filter at once', () => {
      component.clearFilters();

      expect(routerMock.navigate).toHaveBeenCalledWith(
        [],
        expect.objectContaining({
          queryParams: {
            search: null,
            priority: null,
            status: null,
            type: null,
            assignee: null,
            reporter: null,
            sprint: null,
            label: null,
            page: null,
          },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        }),
      );
    });

    it('should reset the buffered search text when clearing filters', () => {
      component.onSearch({ target: { value: 'partial' } });
      component.clearFilters();

      expect(component.searchInput()).toBe('');
    });
  });

  // ── New Task navigation (U1) ───────────────────────────

  describe('goToNewTask', () => {
    beforeEach(() => setup());

    it('should navigate to the unified create-task page instead of opening a dialog', () => {
      component.goToNewTask();

      // The ActivatedRoute mock resolves every param to 'ABC' — including tenantSlug
      expect(routerMock.navigate).toHaveBeenCalledWith(['/t', 'ABC', 'projects', 'ABC', 'tasks', 'new']);
    });
  });

  // ── U3/V4-8: constrained table layout ──────────────────
  // V4-8 (V6): `table-fixed` ignores `min-width`, so the Title th collapsed to
  // 0px whenever the fixed px columns consumed the table width and the Type
  // header swallowed mouse clicks on the Title sort button. The table must NOT
  // use `table-fixed`; auto layout + per-cell `truncate` keeps widths stable.

  describe('constrained layout (U3 / V4-8)', () => {
    beforeEach(() => setup());

    it('should render a full-width table WITHOUT table-fixed', () => {
      const table = fixture.nativeElement.querySelector('table');

      expect(table.classList.contains('table-fixed')).toBe(false);
      expect(table.classList.contains('w-full')).toBe(true);
    });

    it('should give every non-title column an explicit width class', () => {
      const widths: [string, string | undefined][] = component.taskColumns.map(
        (c: { field: string; width?: string }) => [c.field, c.width],
      );
      const expected: Record<string, string> = {
        number: 'w-[90px]',
        typeId: 'w-[90px]',
        statusId: 'w-[130px]',
        priority: 'w-[100px]',
        assigneeId: 'w-[130px]',
        reporterId: 'w-[130px]',
        sprintId: 'w-[110px]',
        labelIds: 'w-[140px]',
        createdAt: 'w-[100px]',
        updatedAt: 'w-[100px]',
      };

      for (const [field, width] of Object.entries(expected)) {
        expect(widths.find(([f]) => f === field)?.[1]).toBe(width);
      }
      // Title gets an explicit percentage share (V4-8 reopened: no 0px collapse)
      expect(component.taskColumns.find((c: { field: string }) => c.field === 'title').width).toBe(
        'w-[30%] min-w-[200px]',
      );
    });

    it('should hard-truncate a 500-char unbreakable title (max-w-0 + truncate + tooltip)', () => {
      const longTitle = 'x'.repeat(500);

      taskClientMock.list.mockReturnValue(
        of({
          data: [
            {
              id: 't1',
              number: 1,
              title: longTitle,
              priority: 'HIGH',
              typeId: 'type1',
              statusId: 'st1',
              labelIds: ['l1'],
              createdAt: '2026-01-01T00:00:00Z',
              updatedAt: '2026-01-01T00:00:00Z',
            },
          ],
          pagination: { total: 1, page: 1, limit: 30, totalPages: 1 },
        }),
      );

      const fixture2 = TestBed.createComponent(TaskTable);

      fixture2.componentRef.setInput('projectKey', 'ABC');
      fixture2.detectChanges();

      const titleCell: HTMLElement = fixture2.nativeElement.querySelector('tbody tr td:nth-child(2)');

      // R3-P3: max-w-0 removes the cell's intrinsic width contribution under table-auto,
      // so an unbreakable title can never widen the column/table (no horizontal scroll)
      expect(titleCell.classList.contains('max-w-0')).toBe(true);
      expect(titleCell.classList.contains('truncate')).toBe(true);
      expect(titleCell.getAttribute('title')).toBe(longTitle);
    });

    it('should lay out as a fixed-height flex column with a flexing table wrapper (R3-P3)', () => {
      // beforeEach already ran setup()
      const root: HTMLElement = fixture.nativeElement.children[0];

      // Exactly viewport minus app header (--header-height: 4rem) minus main p-6 (2×1.5rem)
      expect(root.classList.contains('h-[calc(100dvh-var(--header-height)-3rem)]')).toBe(true);
      expect(root.classList.contains('flex-col')).toBe(true);

      const wrap = component.tableWrapRef()?.nativeElement as HTMLElement | undefined;

      expect(wrap).toBeTruthy();
      expect(wrap?.classList.contains('flex-1')).toBe(true);
      expect(wrap?.classList.contains('min-h-0')).toBe(true);
    });
  });

  // ── U3: stable body height ─────────────────────────────

  describe('body min-height (U3)', () => {
    it('should pad short pages up to page-size × row height', () => {
      setup({}, 30);
      component.tasks.set([{ id: 't1' } as never]);

      // 30 rows × 48px − 1 rendered row × 48px
      expect(component.bodySpacerHeight()).toBe(29 * TASK_ROW_HEIGHT_PX);
    });

    it('should not pad a full page', () => {
      setup({}, 30);
      component.tasks.set(Array.from({ length: 30 }, (_, i) => ({ id: `t${i}` }) as never));

      expect(component.bodySpacerHeight()).toBe(0);
    });
  });

  // ── U3: Auto page-size ─────────────────────────────────

  describe('auto page-size (U3 / R3-P3 — measured wrapper height)', () => {
    /**
     * Minimal ResizeObserver stub — jsdom has none. Records instances AND observed
     * elements so tests can trigger the observer watching the table wrapper (other
     * UI-kit directives may create their own observers on the same page).
     */
    class MockResizeObserver {
      static instances: MockResizeObserver[] = [];
      readonly observed: Element[] = [];
      readonly unobserve = vi.fn();
      readonly disconnect = vi.fn();
      private readonly cb: ResizeObserverCallback;

      constructor(cb: ResizeObserverCallback) {
        this.cb = cb;
        MockResizeObserver.instances.push(this);
      }

      observe(target: Element): void {
        this.observed.push(target);
      }

      trigger(wrapperHeight: number): void {
        this.cb(
          [{ contentRect: { height: wrapperHeight } } as unknown as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        );
      }
    }

    /** The observer the component attached to the table wrapper */
    function wrapperObserver(): MockResizeObserver | undefined {
      const el = component.tableWrapRef()?.nativeElement as Element | undefined;

      return MockResizeObserver.instances.find((i) => el !== undefined && i.observed.includes(el));
    }

    beforeEach(() => {
      MockResizeObserver.instances = [];
      vi.stubGlobal('ResizeObserver', MockResizeObserver);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should compute clamped rows from the measured available height', () => {
      expect(computeAutoPageSize(714)).toBe(14); // floor(714/48)
      expect(computeAutoPageSize(239)).toBe(5); // clamped to minimum
      expect(computeAutoPageSize(100000)).toBe(100); // clamped to maximum
    });

    it('should derive the effective size from the MEASURED wrapper when Auto is persisted', () => {
      setup({}, AUTO_PAGE_SIZE_SENTINEL);

      expect(component.isAutoMode()).toBe(true);

      const ro = wrapperObserver();

      expect(ro).toBeDefined();

      ro?.trigger(720); // floor(720/48) = 15 rows
      fixture.detectChanges();

      expect(component.pageSize()).toBe(15);
    });

    it('should recompute on wrapper resize and refetch only when the row count changes', () => {
      setup({}, AUTO_PAGE_SIZE_SENTINEL);

      const ro = wrapperObserver();
      const initialCalls = taskClientMock.list.mock.calls.length;

      ro?.trigger(720); // 15 rows
      fixture.detectChanges();

      const afterFirst = taskClientMock.list.mock.calls.length;

      expect(component.pageSize()).toBe(15);
      expect(afterFirst).toBeGreaterThan(initialCalls);

      const lastQuery = taskClientMock.list.mock.calls[afterFirst - 1][1];

      expect(lastQuery).toEqual(expect.objectContaining({ limit: 15 }));

      ro?.trigger(730); // still 15 rows → no refetch
      fixture.detectChanges();
      expect(taskClientMock.list.mock.calls.length).toBe(afterFirst);

      ro?.trigger(2000); // floor(2000/48) = 41 rows → one refetch
      fixture.detectChanges();

      expect(component.pageSize()).toBe(41);
      expect(taskClientMock.list.mock.calls.length).toBe(afterFirst + 1);
    });

    it('should fill the page at common viewport heights (900px / 700px mocked chrome-adjusted wrappers)', () => {
      setup({}, AUTO_PAGE_SIZE_SENTINEL);

      const ro = wrapperObserver();

      // 900px viewport − header/paddings chrome ≈ 788px of table wrapper
      ro?.trigger(788);
      fixture.detectChanges();
      expect(component.pageSize()).toBe(16); // floor(788/48)

      // 700px viewport ≈ 588px of table wrapper
      ro?.trigger(588);
      fixture.detectChanges();
      expect(component.pageSize()).toBe(12); // floor(588/48)
    });

    it('should persist the Auto sentinel and omit limit from the URL when selected', () => {
      setup();

      const setPageSize = TestBed.inject(PreferencesStore).setPageSize as ReturnType<typeof vi.fn>;

      component.onAutoPageSize();

      expect(setPageSize).toHaveBeenCalledWith(AUTO_PAGE_SIZE_SENTINEL);
      expect(routerMock.navigate).toHaveBeenCalledWith(
        [],
        expect.objectContaining({ queryParams: { limit: null, page: null }, queryParamsHandling: 'merge' }),
      );
    });

    it('should persist numeric sizes with the URL limit param', () => {
      setup();

      const setPageSize = TestBed.inject(PreferencesStore).setPageSize as ReturnType<typeof vi.fn>;

      component.onPageSizeChange(50);

      expect(setPageSize).toHaveBeenCalledWith(50);
      expect(routerMock.navigate).toHaveBeenCalledWith(
        [],
        expect.objectContaining({ queryParams: { limit: 50, page: null }, queryParamsHandling: 'merge' }),
      );
    });
  });

  // ── DR-1 status display names + DR-4 label chip padding ─

  describe('status names & label padding (DR-1/DR-4)', () => {
    beforeEach(() => setup());

    function renderOneTask(): ComponentFixture<TaskTable> {
      taskClientMock.list.mockReturnValue(
        of({
          data: [
            {
              id: 't1',
              number: 1,
              title: 'Task A',
              priority: 'HIGH',
              typeId: 'type1',
              statusId: 'st1',
              labelIds: ['l1'],
              createdAt: '2026-01-01T00:00:00Z',
              updatedAt: '2026-01-01T00:00:00Z',
            },
          ],
          pagination: { total: 1, page: 1, limit: 30, totalPages: 1 },
        }),
      );

      const fx = TestBed.createComponent(TaskTable);

      fx.componentRef.setInput('projectKey', 'ABC');
      fx.detectChanges();

      return fx;
    }

    it('should render the status badge with the human display name, not the raw id', () => {
      const fx = renderOneTask();
      const statusCell: HTMLElement = fx.nativeElement.querySelector('tbody tr td:nth-child(4)');

      expect(statusCell.textContent?.trim()).toBe('To Do');
      expect(statusCell.getAttribute('title')).toBe('To Do');
    });

    it('should expose named status options to the column filter select', () => {
      renderOneTask();

      const statusColumn = component.taskColumns.find((c: { field: string }) => c.field === 'statusId');
      const options: { id: string; name: string }[] = statusColumn.getOptions();

      expect(options).toEqual([{ id: 'st1', name: 'To Do' }]);
      expect(statusColumn.itemToString('st1')).toBe('To Do');
    });

    it('should pad the labels cell so chips do not crowd the right edge (DR-4)', () => {
      const fx = renderOneTask();
      // Columns: 1 Key, 2 Title, 3 Type, 4 Status, 5 Priority, 6 Assignee, 7 Reporter, 8 Sprint, 9 Labels
      const labelsCell: HTMLElement = fx.nativeElement.querySelector('tbody tr td:nth-child(9)');

      expect(labelsCell.classList.contains('pr-4')).toBe(true);
    });
  });

  // ── V1-3: NaN guard + stale-list refresh ───────────────

  describe('limit NaN guard (V1-3)', () => {
    it('should map garbage numeric params to the fallback instead of NaN', () => {
      expect(safeNumericParam('abc')).toBe(0);
      expect(safeNumericParam('')).toBe(0);
      expect(safeNumericParam(null)).toBe(0);
      expect(safeNumericParam('25')).toBe(25);
    });

    it('should fall back to the stored preference when the URL limit is not a number', () => {
      setup({ limit: 'abc' }, 30);

      expect(Number.isNaN(component.pageSize())).toBe(false);
      expect(component.pageSize()).toBe(30);
    });

    it('should never write a non-finite page size to the URL', () => {
      setup();
      component.onPageSizeChange(Number.NaN);

      expect(routerMock.navigate).not.toHaveBeenCalled();
    });

    it('should refetch when a navigation completes after mount (stale list fix)', async () => {
      setup();

      const callsAfterMount = taskClientMock.list.mock.calls.length;

      // First NavigationEnd belongs to this mount — skipped…
      routerEvents.next(new NavigationEnd(1, '/tasks', '/tasks'));

      await new Promise((r) => setTimeout(r, 0));

      expect(taskClientMock.list.mock.calls.length).toBe(callsAfterMount);

      // …any later one (e.g. browser-back from tasks/new) triggers a refresh.
      routerEvents.next(new NavigationEnd(2, '/tasks', '/tasks'));

      await new Promise((r) => setTimeout(r, 0));

      expect(taskClientMock.list.mock.calls.length).toBe(callsAfterMount + 1);
    });
  });

  // ── V2-10: role-gated New Task control ─────────────────

  describe('role-gated write controls (V2-10)', () => {
    it('should hide the New Task control from VIEWER-role users', () => {
      setup({}, 30, null, 'VIEWER');

      expect(component.canCreateTasks()).toBe(false);

      fixture.detectChanges();

      // Transloco test module has no dictionaries — the raw key would render if ungated
      expect(fixture.nativeElement.textContent).not.toContain('taskTable.newTask');
    });

    it('should show the New Task control to EDITOR-role users', () => {
      setup({}, 30, null, 'EDITOR');

      expect(component.canCreateTasks()).toBe(true);
    });
  });

  // ── R3-P4: column chooser ──────────────────────────────

  describe('column chooser (R3-P4)', () => {
    function storeMocks() {
      return TestBed.inject(PreferencesStore) as unknown as {
        setTaskTableColumns: ReturnType<typeof vi.fn>;
        getTaskTableColumns: ReturnType<typeof vi.fn>;
      };
    }

    it('should render all 11 columns when the persisted preference is null (default set)', () => {
      setup();

      const headers = fixture.nativeElement.querySelectorAll('thead th');

      expect(headers).toHaveLength(11);
      expect(component.visibleColumnCount()).toBe(11);
    });

    it('should remove hidden columns from the DOM when a preference is stored', () => {
      setup({}, 30, 'OWNER', null, ['key', 'title', 'priority']);

      fixture.detectChanges();

      const headers = Array.from(fixture.nativeElement.querySelectorAll('thead th')) as HTMLElement[];
      const headerText = headers.map((h) => h.textContent ?? '').join('|');

      expect(headers).toHaveLength(3);
      expect(headerText).toContain('taskTable.key');
      expect(headerText).toContain('taskTable.titleCol');
      expect(headerText).toContain('taskTable.priority');
      expect(headerText).not.toContain('taskTable.type');

      // colspan of the empty-state row follows the visible count
      expect(component.visibleColumnCount()).toBe(3);
    });

    it('should always keep the pinned Key/Title columns even if missing from the preference', () => {
      setup({}, 30, 'OWNER', null, ['status']);

      fixture.detectChanges();

      const headers = Array.from(fixture.nativeElement.querySelectorAll('thead th')) as HTMLElement[];
      const headerText = headers.map((h) => h.textContent ?? '').join('|');

      expect(headerText).toContain('taskTable.key');
      expect(headerText).toContain('taskTable.titleCol');
      expect(headerText).toContain('taskTable.status');
      expect(headers).toHaveLength(3);
    });

    it('should apply a toggle immediately and persist the canonical payload after ~400 ms', () => {
      vi.useFakeTimers();
      setup();

      component.toggleColumn('type', false);

      // Applied immediately…
      expect(component.visibleFields().has('typeId')).toBe(false);

      // …but not yet persisted
      const { setTaskTableColumns } = storeMocks();

      expect(setTaskTableColumns).not.toHaveBeenCalled();

      vi.advanceTimersByTime(400);

      // Persisted in canonical column order, without `type`
      expect(setTaskTableColumns).toHaveBeenCalledWith('p1', [
        'key',
        'title',
        'status',
        'priority',
        'assignee',
        'reporter',
        'sprint',
        'labels',
        'created',
        'updated',
      ]);

      vi.useRealTimers();
    });

    it('should coalesce rapid toggles into one debounced persist call', () => {
      vi.useFakeTimers();
      setup();

      component.toggleColumn('type', false);
      vi.advanceTimersByTime(200);
      component.toggleColumn('type', true);
      vi.advanceTimersByTime(400);

      const { setTaskTableColumns } = storeMocks();
      const calls = setTaskTableColumns.mock.calls as unknown[];

      expect(calls).toHaveLength(1);
      // Re-showing restores the full default set
      expect(setTaskTableColumns).toHaveBeenCalledWith('p1', [
        'key',
        'title',
        'type',
        'status',
        'priority',
        'assignee',
        'reporter',
        'sprint',
        'labels',
        'created',
        'updated',
      ]);

      vi.useRealTimers();
    });

    it('must not hide the pinned Key/Title columns', () => {
      vi.useFakeTimers();
      setup();

      component.toggleColumn('key', false);
      component.toggleColumn('title', false);

      expect(component.visibleFields().has('number')).toBe(true);
      expect(component.visibleFields().has('title')).toBe(true);

      vi.advanceTimersByTime(400);

      const { setTaskTableColumns } = storeMocks();

      expect(setTaskTableColumns).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should hide the context-targeted column via "Hide this column"', () => {
      vi.useFakeTimers();
      setup();

      const typeColumn = component.taskColumns.find((c: { field: string }) => c.field === 'typeId');

      component.contextColumn.set(typeColumn);
      component.hideContextColumn();

      expect(component.visibleFields().has('typeId')).toBe(false);

      vi.advanceTimersByTime(400);

      const { setTaskTableColumns } = storeMocks();

      expect(setTaskTableColumns).toHaveBeenCalledWith('p1', expect.not.arrayContaining(['type']));

      vi.useRealTimers();
    });

    it('should disable "Hide this column" for pinned columns', () => {
      setup();

      const keyColumn = component.taskColumns.find((c: { field: string }) => c.field === 'number');

      component.contextColumn.set(keyColumn);

      expect(component.canHideContextColumn()).toBe(false);
    });

    it('should open the chooser from the context menu action', () => {
      setup();

      expect(component.showColumnChooser()).toBe(false);

      component.openChooserFromContextMenu();

      expect(component.showColumnChooser()).toBe(true);
    });
  });
});
