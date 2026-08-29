import { inject, signal, computed, type Signal, type WritableSignal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PreferencesStore } from '@stores/preferences-store';
import {
  AUTO_PAGE_SIZE_SENTINEL,
  computeAutoPageSize,
  TABLE_ROW_HEIGHT_PX,
} from '@app/shared/auto-table/auto-page-size';

/** Definition of a per-column text/select filter. */
export interface MemberColumnFilter<T> {
  /** Returns true when the item matches the given query string. */
  matches: (item: T, query: string) => boolean;
}

/** Configuration for {@link useMemberTable}. */
export interface MemberTableConfig<T> {
  /** The full, unfiltered member list. */
  source: Signal<T[]>;
  /** Column filters keyed by field name (also used as URL query param). */
  filters: Record<string, MemberColumnFilter<T>>;
  /** String accessors used for sorting, keyed by field name. */
  sorters: Record<string, (item: T) => string>;
  /** Load callback invoked whenever URL query params change. */
  load: () => void;
  /**
   * Q2 (F-05): measured table-wrapper height enabling Auto page-size mode — when the
   * persisted preference is the Auto sentinel (0), the effective page size is derived
   * from this signal via `computeAutoPageSize`.
   */
  autoAvailableHeight?: Signal<number>;
  /**
   * Measured row PITCH (bounding rect + shared border, from
   * {@link useAutoRowMeasurement}) — makes the Auto math exact; falls back to
   * `TABLE_ROW_HEIGHT_PX` until the first measurement arrives.
   */
  autoRowHeight?: Signal<number>;
}

/** Shared sort / column-filter / pagination state for member tables. */
export interface MemberTableState<T> {
  page: WritableSignal<number>;
  pageSize: WritableSignal<number>;
  total: Signal<number>;
  totalPages: Signal<number>;
  paginated: Signal<T[]>;
  sortField: WritableSignal<string>;
  sortDirection: WritableSignal<'asc' | 'desc'>;
  toggleSort: (field: string) => void;
  getFilterValue: (field: string) => string;
  onColumnFilterChange: (field: string, value: string) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  /** Apply URL query params (?name=…&sort=field:dir) and invoke load(). */
  syncFromParams: (params: Record<string, string>) => void;
  /** Write current filter/sort state back to the URL. */
  syncToUrl: () => void;
}

/**
 * Shared machinery for the tenant/project member tables:
 * column sorting, per-column filtering (synced to URL query params)
 * and client-side pagination with a persisted page size.
 *
 * Must be called within an injection context.
 */
export function useMemberTable<T>(config: MemberTableConfig<T>): MemberTableState<T> {
  const router = inject(Router);
  const route = inject(ActivatedRoute);
  const preferencesStore = inject(PreferencesStore);
  const page = signal(1);
  // Raw persisted value; `0` is the shared Auto sentinel and is resolved below.
  const pageSize = signal(preferencesStore.pageSize());
  /** Q2 (F-05): true when the persisted preference is the Auto sentinel. */
  const isAutoMode = computed(() => pageSize() === AUTO_PAGE_SIZE_SENTINEL);
  /** Effective numeric page size — derived from the measured height in Auto mode. */
  const effectivePageSize = computed(() =>
    isAutoMode()
      ? computeAutoPageSize(config.autoAvailableHeight?.() ?? 0, config.autoRowHeight?.() || TABLE_ROW_HEIGHT_PX)
      : pageSize(),
  );
  const sortField = signal('');
  const sortDirection = signal<'asc' | 'desc'>('asc');
  const filterValues = signal<Record<string, string>>({});
  const sorted = computed(() => {
    const list = [...config.source()];
    const field = sortField();
    const dir = sortDirection() === 'asc' ? 1 : -1;

    if (!field) return list;

    const accessor = config.sorters[field];

    if (!accessor) return list;

    return list.sort((a, b) => accessor(a).localeCompare(accessor(b)) * dir);
  });
  const filtered = computed(() => {
    let list = sorted();
    const values = filterValues();

    for (const [field, value] of Object.entries(values)) {
      if (!value) continue;

      const filter = config.filters[field];

      if (filter) {
        list = list.filter((item) => filter.matches(item, value));
      }
    }

    return list;
  });
  const total = computed(() => filtered().length);
  const totalPages = computed(() => Math.max(1, Math.ceil(total() / effectivePageSize())));
  const paginated = computed(() => {
    const size = effectivePageSize();
    const start = (page() - 1) * size;

    return filtered().slice(start, start + size);
  });

  function syncToUrl(): void {
    const queryParams: Record<string, string | null> = {};

    for (const field of Object.keys(config.filters)) {
      queryParams[field] = filterValues()[field] || null;
    }
    queryParams['sort'] = sortField() ? `${sortField()}:${sortDirection()}` : null;

    router.navigate([], { relativeTo: route, queryParams, replaceUrl: true });
  }

  return {
    page,
    pageSize,
    total,
    totalPages,
    paginated,
    sortField,
    sortDirection,
    toggleSort(field: string): void {
      if (sortField() === field) {
        if (sortDirection() === 'asc') {
          sortDirection.set('desc');
        } else {
          // Was desc → clear sort entirely
          sortField.set('');
          sortDirection.set('asc');
        }
      } else {
        sortField.set(field);
        sortDirection.set('asc');
      }
      syncToUrl();
    },
    getFilterValue(field: string): string {
      return filterValues()[field] ?? '';
    },
    onColumnFilterChange(field: string, value: string): void {
      filterValues.update((values) => ({ ...values, [field]: value }));
      page.set(1);
      syncToUrl();
    },
    onPageChange(newPage: number): void {
      page.set(newPage);
    },
    onPageSizeChange(newSize: number): void {
      pageSize.set(newSize);
      preferencesStore.setPageSize(newSize);
      page.set(1);
    },
    syncFromParams(params: Record<string, string>): void {
      const values: Record<string, string> = {};

      for (const field of Object.keys(config.filters)) {
        values[field] = params[field] ?? '';
      }
      filterValues.set(values);

      const sortParam = params['sort'] ?? '';

      if (sortParam) {
        const [field, direction] = sortParam.split(':');

        sortField.set(field ?? '');
        sortDirection.set(direction === 'asc' ? 'asc' : 'desc');
      } else {
        sortField.set('');
        sortDirection.set('asc');
      }

      config.load();
    },
    syncToUrl,
  };
}
