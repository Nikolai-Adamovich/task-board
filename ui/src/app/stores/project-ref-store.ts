import { Service, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { StatusClient } from '@services/status-client';
import { TaskTypeClient } from '@services/task-type-client';
import { SprintClient } from '@services/sprint-client';
import { LabelClient } from '@services/label-client';
import { ProjectClient } from '@services/project-client';

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
 * One cached copy per `${projectId}:${kind}` — components stop fetching and
 * mapping these lists themselves. Reads are reactive: {@link options} and
 * {@link nameMap} read a signal, so templates/computeds update when data arrives.
 * Mutating managers call {@link invalidate} after create/update/delete.
 *
 * @example
 * ```ts
 * private readonly refStore = inject(ProjectRefStore);
 * // in an injection-context effect or ngOnInit:
 * this.refStore.ensure(this.projectId(), ['statuses', 'types']);
 * // reactive read:
 * protected readonly statusOptions = computed(() => this.refStore.options(this.projectId(), 'statuses'));
 * ```
 */
@Service()
export class ProjectRefStore {
  private readonly statusClient = inject(StatusClient);
  private readonly taskTypeClient = inject(TaskTypeClient);
  private readonly sprintClient = inject(SprintClient);
  private readonly labelClient = inject(LabelClient);
  private readonly projectClient = inject(ProjectClient);
  /** key `${projectId}:${kind}` → option list */
  private readonly state = signal<Record<string, SelectOption[]>>({});
  /** keys currently being fetched (dedupe guard) */
  private readonly inFlight = new Set<string>();

  /** Reactive read of a cached option list (empty while loading). */
  options(projectId: string, kind: RefKind): SelectOption[] {
    return this.state()[`${projectId}:${kind}`] ?? [];
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

      if (this.inFlight.has(key) || this.state()[key]) continue;

      this.inFlight.add(key);
      this.fetch(kind, projectId)
        .then((options) => {
          this.state.update((state) => ({ ...state, [key]: options }));
        })
        .catch(() => {
          // Leave uncached so a later ensure() can retry
        })
        .finally(() => {
          this.inFlight.delete(key);
        });
    }
  }

  /** Drop the cache for one kind (call after create/update/delete). */
  invalidate(projectId: string, kind: RefKind): void {
    const key = `${projectId}:${kind}`;
    const next: Record<string, SelectOption[]> = {};

    for (const [existingKey, value] of Object.entries(this.state())) {
      if (existingKey !== key) {
        next[existingKey] = value;
      }
    }
    this.state.set(next);
  }

  private fetch(kind: RefKind, projectId: string): Promise<SelectOption[]> {
    switch (kind) {
      case 'statuses':
        return firstValueFrom(this.statusClient.list(projectId)).then((items) =>
          items.map((s) => ({ id: s.id, name: s.name })),
        );

      case 'types':
        return firstValueFrom(this.taskTypeClient.list(projectId)).then((items) =>
          items.map((t) => ({ id: t.id, name: t.name, key: t.key })),
        );

      case 'sprints':
        return firstValueFrom(this.sprintClient.list(projectId)).then((items) =>
          items.map((s) => ({ id: s.id, name: s.name })),
        );

      case 'labels':
        return firstValueFrom(this.labelClient.list(projectId)).then((items) =>
          items.map((l) => ({ id: l.id, name: l.name })),
        );

      case 'members':
        return firstValueFrom(this.projectClient.listMembers(projectId)).then((items) =>
          items.map((m) => ({ id: m.userId, name: m.displayName ?? m.userId })),
        );
    }
  }
}
