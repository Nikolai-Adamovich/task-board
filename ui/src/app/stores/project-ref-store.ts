import { Service, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { StatusClient } from '@services/status-client';
import { TaskTypeClient } from '@services/task-type-client';
import { SprintClient } from '@services/sprint-client';
import { LabelClient } from '@services/label-client';
import { ProjectClient } from '@services/project-client';
import { ProjectStore } from '@stores/project-store';
import type { Label, ProjectMember, Sprint, Status, TaskType } from '@task-board/shared';

/** Reference-data kinds every project view needs for id⇄name resolution */
export type RefKind = 'statuses' | 'types' | 'sprints' | 'labels' | 'members';

export interface SelectOption {
  id: string;
  name: string;
  /** Optional stable key (e.g. task-type key: "bug", "story") */
  key?: string;
}

/**
 * Shared per-project reference data (statuses, task types, sprints, labels, members).
 *
 * F2: the cache stores FULL DTOs (Status[], Sprint[], …) per `${projectId}:${kind}`
 * — one fetch per kind per project session. The [`options`](#options) layer is
 * DERIVED from the DTO cache, so select-style consumers (task table, filters)
 * and full-entity consumers (overview, board, sprint pages) share the same
 * request and the same invalidation. Mutating managers call
 * [`invalidate`](#invalidate) (drop → next ensure refetches) or
 * [`upsertEntity`](#upsertEntity) (patch the cached list in place).
 *
 * Reads are reactive: [`options`](#options), [`entities`](#entities),
 * [`statusEntities`](#statusEntities) and [`sprintEntities`](#sprintEntities)
 * read a signal, so templates/computeds update when data arrives.
 * Concurrent and repeated `ensure()` calls are deduped into one HTTP request;
 * failed fetches stay uncached so a later ensure() retries.
 *
 * @example
 * ```ts
 * private readonly refStore = inject(ProjectRefStore);
 * // in an injection-context effect or ngOnInit:
 * this.refStore.ensure(this.projectId(), ['statuses', 'types']);
 * // reactive read (select-style):
 * protected readonly statusOptions = computed(() => this.refStore.options(this.projectId(), 'statuses'));
 * // reactive read (full DTOs):
 * protected readonly sprints = computed(() => this.refStore.sprintEntities(this.projectId()));
 * ```
 */
@Service()
export class ProjectRefStore {
  private readonly statusClient = inject(StatusClient);
  private readonly taskTypeClient = inject(TaskTypeClient);
  private readonly sprintClient = inject(SprintClient);
  private readonly labelClient = inject(LabelClient);
  private readonly projectClient = inject(ProjectClient);
  /** M-12: members of the active project come from the ProjectStore cache */
  private readonly projectStore = inject(ProjectStore);
  /** key `${projectId}:${kind}` → full DTO list (F2 cache) */
  private readonly dtoState = signal<Record<string, unknown[]>>({});
  /** key `${projectId}:${kind}` → whether the fetch is in flight */
  private readonly loadingState = signal<Record<string, boolean>>({});
  /** keys currently being fetched (dedupe guard) */
  private readonly inFlight = new Set<string>();

  /** Reactive read of the cached FULL DTO list for a kind (empty while loading). */
  entities(projectId: string, kind: RefKind): unknown[] {
    return this.dtoState()[`${projectId}:${kind}`] ?? [];
  }

  /** Typed read of the cached statuses. */
  statusEntities(projectId: string): Status[] {
    return this.entities(projectId, 'statuses') as Status[];
  }

  /** Typed read of the cached sprints. */
  sprintEntities(projectId: string): Sprint[] {
    return this.entities(projectId, 'sprints') as Sprint[];
  }

  /** Whether the kind's fetch is currently in flight. */
  isLoading(projectId: string, kind: RefKind): boolean {
    return this.loadingState()[`${projectId}:${kind}`] ?? false;
  }

  /** Reactive read of a cached option list (empty while loading) — derived from the DTO cache. */
  options(projectId: string, kind: RefKind): SelectOption[] {
    return this.toOptions(kind, this.entities(projectId, kind));
  }

  /** Reactive id → name map for badges/tables. */
  nameMap(projectId: string, kind: RefKind): Record<string, string> {
    const map: Record<string, string> = {};

    for (const option of this.options(projectId, kind)) {
      map[option.id] = option.name;
    }
    return map;
  }

  /** Resolve an id to its display name (falls back to the raw id). */
  nameOf(projectId: string, kind: RefKind, id: string): string {
    return this.nameMap(projectId, kind)[id] ?? id;
  }

  /**
   * Ensure the given kinds are loaded for the project.
   * Safe to call repeatedly — in-flight/duplicate requests are deduped.
   */
  ensure(projectId: string, kinds: RefKind[]): void {
    if (!projectId) return;

    for (const kind of kinds) {
      const key = `${projectId}:${kind}`;

      if (this.inFlight.has(key) || this.dtoState()[key]) continue;

      this.inFlight.add(key);
      this.loadingState.update((map) => ({ ...map, [key]: true }));
      this.fetchEntities(kind, projectId)
        .then((dtos) => {
          this.dtoState.update((state) => ({ ...state, [key]: dtos }));
        })
        .catch(() => {
          // Leave uncached so a later ensure() can retry
        })
        .finally(() => {
          this.inFlight.delete(key);
          this.loadingState.update((map) => ({ ...map, [key]: false }));
        });
    }
  }

  /** Drop the cache for one kind (call after create/update/delete). */
  invalidate(projectId: string, kind: RefKind): void {
    const key = `${projectId}:${kind}`;
    const nextDtos: Record<string, unknown[]> = {};
    const nextLoading: Record<string, boolean> = {};

    for (const [existingKey, value] of Object.entries(this.dtoState())) {
      if (existingKey !== key) {
        nextDtos[existingKey] = value;
      }
    }

    for (const [existingKey, value] of Object.entries(this.loadingState())) {
      if (existingKey !== key) {
        nextLoading[existingKey] = value;
      }
    }

    this.dtoState.set(nextDtos);
    this.loadingState.set(nextLoading);
  }

  /**
   * Patch a DTO into the cached list in place (create/update mutations).
   * Appends when no entity with the same id exists, replaces otherwise.
   * No-op when the kind is not cached yet (the next ensure() loads it fresh).
   */
  upsertEntity(projectId: string, kind: RefKind, dto: unknown): void {
    const key = `${projectId}:${kind}`;

    this.dtoState.update((state) => {
      const list = state[key];

      if (!list) return state;

      const id = this.entityId(dto);
      const exists = list.some((entry) => this.entityId(entry) === id);

      return {
        ...state,
        [key]: exists ? list.map((entry) => (this.entityId(entry) === id ? dto : entry)) : [...list, dto],
      };
    });
  }

  /** Stable identity of a cached DTO (`id`, or `userId` for members). */
  private entityId(dto: unknown): string {
    const candidate = dto as { id?: string; userId?: string };

    return candidate.id ?? candidate.userId ?? '';
  }

  /** Fetch the full DTO list for a kind. */
  private fetchEntities(kind: RefKind, projectId: string): Promise<unknown[]> {
    switch (kind) {
      case 'statuses':
        return firstValueFrom(this.statusClient.list(projectId));

      case 'types':
        return firstValueFrom(this.taskTypeClient.list(projectId));

      case 'sprints':
        return firstValueFrom(this.sprintClient.list(projectId));

      case 'labels':
        return firstValueFrom(this.labelClient.list(projectId));

      case 'members': {
        // M-12: for the active project, derive members from the ProjectStore
        // cache instead of re-fetching the same list. Other project ids (not
        // held by the store) still go through the client.
        const activeProjectId = this.projectStore.activeProject()?.id;

        if (activeProjectId === projectId) {
          return Promise.resolve(this.projectStore.members());
        }

        return firstValueFrom(this.projectClient.listMembers(projectId));
      }
    }
  }

  /** Derive the select-style option list from a DTO list. */
  private toOptions(kind: RefKind, dtos: unknown[]): SelectOption[] {
    switch (kind) {
      case 'statuses':
        return (dtos as Status[]).map((s) => ({ id: s.id, name: s.name }));

      case 'types':
        return (dtos as TaskType[]).map((t) => ({ id: t.id, name: t.name, key: t.key }));

      case 'sprints':
        return (dtos as Sprint[]).map((s) => ({ id: s.id, name: s.name }));

      case 'labels':
        return (dtos as Label[]).map((l) => ({ id: l.id, name: l.name }));

      case 'members':
        return (dtos as ProjectMember[]).map((m) => ({ id: m.userId, name: m.displayName ?? m.userId }));
    }
  }
}
