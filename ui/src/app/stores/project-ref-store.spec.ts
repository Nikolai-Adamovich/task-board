/**
 * Tests for the ProjectRefStore.
 *
 * Covers:
 * - ensure(): fetches reference data per `${projectId}:${kind}`, caches it,
 *   dedupes concurrent and repeated calls
 * - invalidate(): drops one cached kind so the next ensure() refetches
 * - options()/nameMap()/nameOf(): reactive reads with id⇄name resolution
 * - error handling: a failed fetch stays uncached so a later ensure() retries
 */
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ProjectRefStore } from './project-ref-store';
import { ProjectStore } from './project-store';
import { StatusClient } from '@services/status-client';
import { TaskTypeClient } from '@services/task-type-client';
import { SprintClient } from '@services/sprint-client';
import { LabelClient } from '@services/label-client';
import { ProjectClient } from '@services/project-client';
import type { Project, ProjectMember } from '@task-board/shared';

describe('ProjectRefStore', () => {
  let statusList: ReturnType<typeof vi.fn>;
  let taskTypeList: ReturnType<typeof vi.fn>;
  let sprintList: ReturnType<typeof vi.fn>;
  let labelList: ReturnType<typeof vi.fn>;
  let listMembers: ReturnType<typeof vi.fn>;

  function createModule() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: StatusClient, useValue: { list: (statusList = vi.fn().mockReturnValue(of([]))) } },
        { provide: TaskTypeClient, useValue: { list: (taskTypeList = vi.fn().mockReturnValue(of([]))) } },
        { provide: SprintClient, useValue: { list: (sprintList = vi.fn().mockReturnValue(of([]))) } },
        { provide: LabelClient, useValue: { list: (labelList = vi.fn().mockReturnValue(of([]))) } },
        { provide: ProjectClient, useValue: { listMembers: (listMembers = vi.fn().mockReturnValue(of([]))) } },
      ],
    });
  }

  function createStore(): ProjectRefStore {
    return TestBed.inject(ProjectRefStore);
  }

  /** Flush the promise chain inside ensure(). */
  function flush(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  beforeEach(() => {
    createModule();
  });

  // ── options / nameMap / nameOf (reactive reads) ─────────────────────────

  describe('options', () => {
    it('returns an empty list before ensure() is called', () => {
      const store = createStore();

      expect(store.options('p1', 'statuses')).toEqual([]);
    });

    it('returns the cached options after ensure() resolves', async () => {
      statusList.mockReturnValue(
        of([
          { id: 's1', name: 'TODO' },
          { id: 's2', name: 'DONE' },
        ]),
      );

      const store = createStore();

      store.ensure('p1', ['statuses']);
      await flush();

      expect(store.options('p1', 'statuses')).toEqual([
        { id: 's1', name: 'TODO' },
        { id: 's2', name: 'DONE' },
      ]);
    });
  });

  describe('nameMap / nameOf', () => {
    it('maps ids to names', async () => {
      statusList.mockReturnValue(of([{ id: 's1', name: 'TODO' }]));

      const store = createStore();

      store.ensure('p1', ['statuses']);
      await flush();

      expect(store.nameMap('p1', 'statuses')).toEqual({ s1: 'TODO' });
      expect(store.nameOf('p1', 'statuses', 's1')).toBe('TODO');
    });

    it('falls back to the raw id for unknown ids', () => {
      const store = createStore();

      expect(store.nameOf('p1', 'statuses', 'unknown-id')).toBe('unknown-id');
    });
  });

  // ── ensure() ─────────────────────────────────────────────────────────────

  describe('ensure', () => {
    it('fetches each requested kind from the right client', async () => {
      statusList.mockReturnValue(of([{ id: 's1', name: 'TODO' }]));
      taskTypeList.mockReturnValue(of([{ id: 't1', name: 'Bug', key: 'BUG' }]));
      sprintList.mockReturnValue(of([{ id: 'sp1', name: 'Sprint 1' }]));
      labelList.mockReturnValue(of([{ id: 'l1', name: 'bug' }]));
      listMembers.mockReturnValue(of([{ userId: 'u1', displayName: 'Alice' }]));

      const store = createStore();

      store.ensure('p1', ['statuses', 'types', 'sprints', 'labels', 'members']);
      await flush();

      expect(statusList).toHaveBeenCalledWith('p1');
      expect(taskTypeList).toHaveBeenCalledWith('p1');
      expect(sprintList).toHaveBeenCalledWith('p1');
      expect(labelList).toHaveBeenCalledWith('p1');
      expect(listMembers).toHaveBeenCalledWith('p1');

      expect(store.options('p1', 'types')).toEqual([{ id: 't1', name: 'Bug', key: 'BUG' }]);
      expect(store.options('p1', 'members')).toEqual([{ id: 'u1', name: 'Alice' }]);
    });

    it('falls back to userId when a member has no displayName', async () => {
      listMembers.mockReturnValue(of([{ userId: 'u1', displayName: null }]));

      const store = createStore();

      store.ensure('p1', ['members']);
      await flush();

      expect(store.options('p1', 'members')).toEqual([{ id: 'u1', name: 'u1' }]);
    });

    it('M-12: derives members from the ProjectStore cache for the active project', async () => {
      const projectStore = TestBed.inject(ProjectStore);

      projectStore.activeProject.set({ id: 'p-active' } as Project);
      projectStore.members.set([{ userId: 'u1', displayName: 'Alice' } as ProjectMember]);

      const store = createStore();

      store.ensure('p-active', ['members']);
      await flush();

      expect(store.options('p-active', 'members')).toEqual([{ id: 'u1', name: 'Alice' }]);
      expect(listMembers).not.toHaveBeenCalled();
    });

    it('M-12: still fetches members via the client for a non-active project', async () => {
      const projectStore = TestBed.inject(ProjectStore);

      projectStore.activeProject.set({ id: 'p-active' } as Project);
      projectStore.members.set([{ userId: 'u1', displayName: 'Alice' } as ProjectMember]);
      listMembers.mockReturnValue(of([{ userId: 'u9', displayName: 'Zoe' }]));

      const store = createStore();

      store.ensure('p-other', ['members']);
      await flush();

      expect(listMembers).toHaveBeenCalledWith('p-other');
      expect(store.options('p-other', 'members')).toEqual([{ id: 'u9', name: 'Zoe' }]);
    });

    it('does not refetch already-cached kinds', async () => {
      statusList.mockReturnValue(of([{ id: 's1', name: 'TODO' }]));

      const store = createStore();

      store.ensure('p1', ['statuses']);
      await flush();

      store.ensure('p1', ['statuses']);
      await flush();

      expect(statusList).toHaveBeenCalledTimes(1);
    });

    it('dedupes concurrent ensure() calls for the same kind', async () => {
      statusList.mockReturnValue(of([{ id: 's1', name: 'TODO' }]));

      const store = createStore();

      store.ensure('p1', ['statuses']);
      store.ensure('p1', ['statuses']);
      await flush();

      expect(statusList).toHaveBeenCalledTimes(1);
    });

    it('caches per project — different projects fetch separately', async () => {
      statusList.mockReturnValue(of([{ id: 's1', name: 'TODO' }]));

      const store = createStore();

      store.ensure('p1', ['statuses']);
      store.ensure('p2', ['statuses']);
      await flush();

      expect(statusList).toHaveBeenCalledTimes(2);
      expect(store.options('p1', 'statuses')).toEqual([{ id: 's1', name: 'TODO' }]);
      expect(store.options('p2', 'statuses')).toEqual([{ id: 's1', name: 'TODO' }]);
    });

    it('is a no-op for an empty projectId', () => {
      const store = createStore();

      store.ensure('', ['statuses']);

      expect(statusList).not.toHaveBeenCalled();
    });

    it('leaves the kind uncached on fetch errors so a later ensure() retries', async () => {
      statusList.mockReturnValue(throwError(() => new Error('boom')));

      const store = createStore();

      store.ensure('p1', ['statuses']);
      await flush();

      expect(store.options('p1', 'statuses')).toEqual([]);

      // Retry succeeds
      statusList.mockReturnValue(of([{ id: 's1', name: 'TODO' }]));
      store.ensure('p1', ['statuses']);
      await flush();

      expect(statusList).toHaveBeenCalledTimes(2);
      expect(store.options('p1', 'statuses')).toEqual([{ id: 's1', name: 'TODO' }]);
    });
  });

  // ── invalidate() ─────────────────────────────────────────────────────────

  describe('invalidate', () => {
    it('drops the cache for one kind so the next ensure() refetches', async () => {
      statusList.mockReturnValue(of([{ id: 's1', name: 'TODO' }]));

      const store = createStore();

      store.ensure('p1', ['statuses']);
      await flush();

      store.invalidate('p1', 'statuses');
      expect(store.options('p1', 'statuses')).toEqual([]);

      store.ensure('p1', ['statuses']);
      await flush();

      expect(statusList).toHaveBeenCalledTimes(2);
      expect(store.options('p1', 'statuses')).toEqual([{ id: 's1', name: 'TODO' }]);
    });

    it('only drops the targeted kind and project', async () => {
      statusList.mockReturnValue(of([{ id: 's1', name: 'TODO' }]));
      labelList.mockReturnValue(of([{ id: 'l1', name: 'bug' }]));

      const store = createStore();

      store.ensure('p1', ['statuses', 'labels']);
      store.ensure('p2', ['statuses']);
      await flush();

      store.invalidate('p1', 'statuses');

      expect(store.options('p1', 'statuses')).toEqual([]);
      expect(store.options('p1', 'labels')).toEqual([{ id: 'l1', name: 'bug' }]);
      expect(store.options('p2', 'statuses')).toEqual([{ id: 's1', name: 'TODO' }]);
    });

    it('is safe to call for a kind that was never loaded', () => {
      const store = createStore();

      expect(() => store.invalidate('p1', 'sprints')).not.toThrow();
      expect(store.options('p1', 'sprints')).toEqual([]);
    });
  });
});
