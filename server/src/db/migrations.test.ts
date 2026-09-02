/**
 * Tests for idempotent data migrations.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  migrateInvitedMembershipsToRevoked,
  renameSeedStatusNames,
  backfillTenantSlugs,
  ensureTenantSlugUniqueIndex,
  ensureTenantSlugIntegrity,
  backfillMemberExpiresAt,
  migrateToSingleBoardPerProject,
  backfillTaskSortNames,
  migrateTaskPriorityToLevel,
} from './migrations.js';

describe('migrateInvitedMembershipsToRevoked', () => {
  it('rewrites ACTIVE members with PENDING invitations to ACCESS_REVOKED', async () => {
    const updateMany = vi.fn().mockResolvedValue({ modifiedCount: 3 });
    const collection = vi.fn().mockReturnValue({ updateMany });
    const db = { collection } as never;
    const count = await migrateInvitedMembershipsToRevoked(db);

    expect(count).toBe(3);
    expect(collection).toHaveBeenCalledWith('tenant_members');
    expect(updateMany).toHaveBeenCalledWith(
      { status: 'ACTIVE', 'invitation.status': 'PENDING' },
      { $set: { status: 'ACCESS_REVOKED' } },
    );
  });

  it('is idempotent — a conformed database yields modifiedCount 0', async () => {
    const updateMany = vi.fn().mockResolvedValue({ modifiedCount: 0 });
    const db = { collection: vi.fn().mockReturnValue({ updateMany }) } as never;
    const count = await migrateInvitedMembershipsToRevoked(db);

    expect(count).toBe(0);
  });
});

// ─── DEC-032 ─────────────────────────────────────────────────────────────────

function createBackfillDb(tenants: Record<string, unknown>[]) {
  const updateOne = vi.fn().mockResolvedValue({ modifiedCount: 1 });

  return {
    db: {
      collection: vi.fn().mockReturnValue({
        find: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue(tenants) }),
        findOne: vi.fn().mockResolvedValue(null),
        updateOne,
      }),
    },
    updateOne,
  };
}

describe('backfillTenantSlugs (DEC-032)', () => {
  it('generates a slug from the tenant name for legacy tenants', async () => {
    const { db, updateOne } = createBackfillDb([{ _id: 'oid-1', name: 'My Workspace' }]);
    const count = await backfillTenantSlugs(db as never);

    expect(count).toBe(1);
    expect(updateOne).toHaveBeenCalledWith({ _id: 'oid-1' }, { $set: { slug: 'my-workspace' } });
  });

  it('appends a numeric suffix (-2, -3…) when the generated slug collides', async () => {
    const { db, updateOne } = createBackfillDb([{ _id: 'oid-1', name: 'My Workspace' }]);
    const tenants = (db as { collection: ReturnType<typeof vi.fn> }).collection();

    // First lookup (candidate 'my-workspace') collides; second ('my-workspace-2') is free
    tenants.findOne.mockResolvedValueOnce({ slug: 'my-workspace' }).mockResolvedValueOnce(null);

    const count = await backfillTenantSlugs(db as never);

    expect(count).toBe(1);
    expect(updateOne).toHaveBeenCalledWith({ _id: 'oid-1' }, { $set: { slug: 'my-workspace-2' } });
  });

  it('is idempotent — a conformed database backfills nothing', async () => {
    const { db, updateOne } = createBackfillDb([]);
    const count = await backfillTenantSlugs(db as never);

    expect(count).toBe(0);
    expect(updateOne).not.toHaveBeenCalled();
  });
});

describe('ensureTenantSlugUniqueIndex (DEC-032)', () => {
  it('creates a unique index on { slug: 1 }', async () => {
    const createIndex = vi.fn().mockResolvedValue('slug_1');
    const db = { collection: vi.fn().mockReturnValue({ createIndex }) } as never;

    await ensureTenantSlugUniqueIndex(db);

    expect(createIndex).toHaveBeenCalledWith({ slug: 1 }, { unique: true });
  });
});

describe('ensureTenantSlugIntegrity (M-04)', () => {
  it('runs the backfill and the unique index creation back-to-back, in that order', async () => {
    const updateOne = vi.fn().mockResolvedValue({ modifiedCount: 1 });
    const createIndex = vi.fn().mockResolvedValue('slug_1');
    const db = {
      collection: vi.fn().mockReturnValue({
        find: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([{ _id: 'oid-1', name: 'My Workspace' }]) }),
        findOne: vi.fn().mockResolvedValue(null),
        updateOne,
        createIndex,
      }),
    } as never;

    await ensureTenantSlugIntegrity(db);

    expect(updateOne).toHaveBeenCalled();
    expect(createIndex).toHaveBeenCalledWith({ slug: 1 }, { unique: true });
    // the index must be created only after the backfill completed
    expect(updateOne.mock.invocationCallOrder[0] ?? Number.NaN).toBeLessThan(
      createIndex.mock.invocationCallOrder[0] ?? Number.NaN,
    );
  });
});

// ─── DR-1 ────────────────────────────────────────────────────────────────────

describe('renameSeedStatusNames (DR-1)', () => {
  function createStatusDb() {
    const updateMany = vi.fn().mockResolvedValue({ modifiedCount: 1 });

    return { db: { collection: vi.fn().mockReturnValue({ updateMany }) } as never, updateMany };
  }

  it('renames raw-key seed statuses to human-readable names', async () => {
    const { db, updateMany } = createStatusDb();
    const count = await renameSeedStatusNames(db);

    // One update per seed status (todo, in_progress, in_review, reopened, done)
    expect(count).toBe(5);
    expect(updateMany).toHaveBeenCalledWith(
      { normalizedName: 'todo', name: 'TODO' },
      { $set: { name: 'To Do', updatedAt: expect.any(Date) } },
    );
    expect(updateMany).toHaveBeenCalledWith(
      { normalizedName: 'in_progress', name: 'IN_PROGRESS' },
      { $set: { name: 'In Progress', updatedAt: expect.any(Date) } },
    );
    expect(updateMany).toHaveBeenCalledWith(
      { normalizedName: 'done', name: 'DONE' },
      { $set: { name: 'Done', updatedAt: expect.any(Date) } },
    );
  });

  it('is idempotent — already-renamed statuses never match the raw-key filter', async () => {
    const { db, updateMany } = createStatusDb();

    // Simulate a conformed database: every rename touches 0 docs
    updateMany.mockResolvedValue({ modifiedCount: 0 });

    const count = await renameSeedStatusNames(db);

    expect(count).toBe(0);
  });

  it('never touches custom user-renamed statuses (match is by normalizedName + exact raw key)', async () => {
    const { db, updateMany } = createStatusDb();

    updateMany.mockResolvedValue({ modifiedCount: 0 });

    await renameSeedStatusNames(db);

    // Filters always pin the exact raw-key name — a status renamed by a user
    // (e.g. normalizedName 'todo' with name 'Backlog') cannot match.
    for (const call of updateMany.mock.calls) {
      expect(call[0].name).toBe(call[0].normalizedName.toUpperCase());
    }
  });
});

// ─── DEC-055 ─────────────────────────────────────────────────────────────────

describe('backfillMemberExpiresAt (DEC-055)', () => {
  it('sets expiresAt to null on legacy member documents missing the field', async () => {
    const updateMany = vi.fn().mockResolvedValue({ modifiedCount: 5 });
    const collection = vi.fn().mockReturnValue({ updateMany });
    const db = { collection } as never;
    const count = await backfillMemberExpiresAt(db);

    expect(count).toBe(5);
    expect(collection).toHaveBeenCalledWith('tenant_members');
    expect(updateMany).toHaveBeenCalledWith({ expiresAt: { $exists: false } }, { $set: { expiresAt: null } });
  });

  it('is idempotent — a conformed database yields modifiedCount 0', async () => {
    const updateMany = vi.fn().mockResolvedValue({ modifiedCount: 0 });
    const db = { collection: vi.fn().mockReturnValue({ updateMany }) } as never;
    const count = await backfillMemberExpiresAt(db);

    expect(count).toBe(0);
  });
});

// ─── Single-board migration (doc 102) ────────────────────────────────────────

function createBoardMigrationDb(boards: unknown[], projects: unknown[]) {
  const boardsCollection = {
    find: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue(boards) }),
    findOne: vi.fn(),
    deleteMany: vi.fn().mockResolvedValue({ deletedCount: 1 }),
    updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
    dropIndex: vi.fn().mockResolvedValue(undefined),
    indexes: vi.fn().mockResolvedValue([]),
  };
  const projectsCollection = {
    findOne: vi.fn().mockResolvedValue(null),
    find: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue(projects) }),
    updateMany: vi.fn().mockResolvedValue({ modifiedCount: 0 }),
  };
  const prefsCollection = { updateMany: vi.fn().mockResolvedValue({ modifiedCount: 0 }) };
  const collections: Record<string, unknown> = {
    boards: boardsCollection,
    projects: projectsCollection,
    user_preferences: prefsCollection,
  };
  const db = {
    collection: vi.fn((name: string) => collections[name]),
  };

  return { db, boardsCollection, projectsCollection, prefsCollection };
}

describe('migrateToSingleBoardPerProject (doc 102)', () => {
  const columns = [{ id: 'col-1', statusIds: ['s1'], position: 0 }];

  it('keeps the board referenced by project.defaultBoardId and drops the extras', async () => {
    const boards = [
      { _id: 'oid-1', id: 'board-old', projectId: 'p1', name: 'Old', type: 'KANBAN', columns, createdAt: new Date(1) },
      {
        _id: 'oid-2',
        id: 'board-default',
        projectId: 'p1',
        name: 'Default',
        type: 'KANBAN',
        columns,
        createdAt: new Date(2),
      },
    ];
    const { db, boardsCollection, projectsCollection } = createBoardMigrationDb(boards, [
      { id: 'p1', defaultBoardId: 'board-default' },
    ]);

    projectsCollection.findOne.mockResolvedValue({ id: 'p1', defaultBoardId: 'board-default' });

    await migrateToSingleBoardPerProject(db as never);

    expect(boardsCollection.deleteMany).toHaveBeenCalledWith({ _id: { $in: ['oid-1'] } });
    // The survivor is normalized: dead fields stripped, projectId preserved
    expect(boardsCollection.updateOne).toHaveBeenCalledWith(
      { _id: 'oid-2' },
      expect.objectContaining({
        $set: expect.objectContaining({ projectId: 'p1', columns }),
        $unset: { id: '', name: '', type: '' },
      }),
    );
  });

  it('falls back to the OLDEST board when the project has no defaultBoardId', async () => {
    const boards = [
      { _id: 'oid-2', projectId: 'p1', columns, createdAt: new Date(2) },
      { _id: 'oid-1', projectId: 'p1', columns, createdAt: new Date(1) },
    ];
    const { db, boardsCollection } = createBoardMigrationDb(boards, [{ id: 'p1', defaultBoardId: 'gone' }]);

    boardsCollection.findOne.mockResolvedValue(null);

    await migrateToSingleBoardPerProject(db as never);

    expect(boardsCollection.deleteMany).toHaveBeenCalledWith({ _id: { $in: ['oid-2'] } });
    expect(boardsCollection.updateOne).toHaveBeenCalledWith({ _id: 'oid-1' }, expect.anything());
  });

  it('unsets dead defaultBoardId fields on projects and user_preferences', async () => {
    const { db, projectsCollection, prefsCollection } = createBoardMigrationDb([], [{ id: 'p1' }]);

    await migrateToSingleBoardPerProject(db as never);

    expect(projectsCollection.updateMany).toHaveBeenCalledWith(
      { defaultBoardId: { $exists: true } },
      { $unset: { defaultBoardId: '' } },
    );
    expect(prefsCollection.updateMany).toHaveBeenCalledWith(
      { defaultBoardId: { $exists: true } },
      { $unset: { defaultBoardId: '' } },
    );
  });

  it('is idempotent — a conformed database is a no-op', async () => {
    const boards = [{ _id: 'oid-1', projectId: 'p1', columns, createdAt: new Date(1) }];
    const { db, boardsCollection } = createBoardMigrationDb(boards, [{ id: 'p1' }]);

    await migrateToSingleBoardPerProject(db as never);

    expect(boardsCollection.deleteMany).not.toHaveBeenCalled();
  });
});

// ─── TOP-2: denormalized task sort names ─────────────────────────────────────

function createSortNamesDb(statuses: { id: string; name: string }[], sprints: { id: string; name: string }[]) {
  const updateMany = vi.fn().mockResolvedValue({ modifiedCount: 1 });
  const entities = (name: string) => ({
    find: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue(name === 'statuses' ? statuses : sprints) }),
  });
  const collections: Record<string, unknown> = {
    statuses: entities('statuses'),
    sprints: entities('sprints'),
    tasks: { updateMany },
  };
  const db = { collection: vi.fn((n: string) => collections[n]) };

  return { db, updateMany };
}

describe('backfillTaskSortNames (TOP-2)', () => {
  it('propagates entity names into the denormalized task fields', async () => {
    const { db, updateMany } = createSortNamesDb([{ id: 's1', name: 'TODO' }], [{ id: 'sp1', name: 'Sprint 1' }]);
    const count = await backfillTaskSortNames(db as never);

    expect(updateMany).toHaveBeenCalledWith(
      { statusId: 's1', statusName: { $ne: 'TODO' } },
      { $set: { statusName: 'TODO' } },
    );
    expect(updateMany).toHaveBeenCalledWith(
      { sprintId: 'sp1', sprintName: { $ne: 'Sprint 1' } },
      { $set: { sprintName: 'Sprint 1' } },
    );
    expect(count).toBeGreaterThan(0);
  });

  it('normalizes orphaned references to null', async () => {
    const { db, updateMany } = createSortNamesDb([], []);

    await backfillTaskSortNames(db as never);

    // No known entities → every task holding a non-null stale name is normalized.
    expect(updateMany).toHaveBeenCalledWith(
      { statusId: { $nin: [] }, statusName: { $exists: true, $ne: null } },
      { $set: { statusName: null } },
    );
    expect(updateMany).toHaveBeenCalledWith(
      { sprintId: { $nin: [] }, sprintName: { $exists: true, $ne: null } },
      { $set: { sprintName: null } },
    );
  });

  it('is idempotent — a conformed database yields modifiedCount 0', async () => {
    const updateMany = vi.fn().mockResolvedValue({ modifiedCount: 0 });
    const db = {
      collection: vi.fn(() => ({
        find: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }),
        updateMany,
      })),
    } as never;
    const count = await backfillTaskSortNames(db);

    expect(count).toBe(0);
  });
});

// ── migrateTaskPriorityToLevel (priority string → numeric priorityLevel) ────

type MockTask = Record<string, unknown>;

function createPriorityDb(taskDocs: MockTask[], filterDocs: MockTask[] = []) {
  const tasks = [...taskDocs];
  const filters = [...filterDocs];
  const updateMany = vi.fn(async (filter: Record<string, unknown>, update: Record<string, unknown>) => {
    let n = 0;

    for (const doc of tasks) {
      const match = Object.entries(filter).every(([k, v]) => {
        if (v !== null && typeof v === 'object') {
          if ('$exists' in v && '$nin' in v)
            return (v.$exists ? k in doc : !(k in doc)) && !(v.$nin as unknown[]).includes(doc[k]);
          if ('$exists' in v) return v.$exists ? k in doc : !(k in doc);
          if ('$nin' in v) return !(v.$nin as unknown[]).includes(doc[k]);
          return false;
        }
        return doc[k] === v;
      });

      if (!match) continue;
      if (update.$set) Object.assign(doc, update.$set);
      if (update.$unset) {
        for (const k of Object.keys(update.$unset)) {
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- emulating Mongo $unset on a plain mock object
          delete doc[k];
        }
      }
      n++;
    }
    return { modifiedCount: n };
  });
  const dropIndex = vi.fn(async () => undefined);
  const updateOne = vi.fn(async (_f: unknown, update: Record<string, unknown>) => {
    const setCriteria = (update.$set ?? {}) as { 'criteria.priorityLevel'?: number[] };
    const unsetKeys = Object.keys((update.$unset ?? {}) as Record<string, unknown>);

    for (const fl of filters) {
      const criteria = fl.criteria as Record<string, unknown>;

      if (setCriteria['criteria.priorityLevel']) criteria.priorityLevel = setCriteria['criteria.priorityLevel'];
      for (const k of unsetKeys) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- emulating Mongo $unset on a plain mock object
        delete criteria[k.replace('criteria.', '')];
      }
    }
    return { modifiedCount: 1 };
  });
  const db = {
    collection: vi.fn((name: string) =>
      name === 'tasks'
        ? {
            countDocuments: vi.fn(async (f: Record<string, unknown>) => {
              const docs: MockTask[] = tasks;

              return docs.filter((doc) =>
                Object.entries(f).every(([k, v]) => {
                  if (v !== null && typeof v === 'object') {
                    if ('$exists' in v && '$nin' in v)
                      return (v.$exists ? k in doc : !(k in doc)) && !(v.$nin as unknown[]).includes(doc[k]);
                    if ('$exists' in v) return v.$exists ? k in doc : !(k in doc);
                    if ('$nin' in v) return !(v.$nin as unknown[]).includes(doc[k]);
                    return false;
                  }
                  return doc[k] === v;
                }),
              ).length;
            }),
            updateMany,
            dropIndex,
          }
        : {
            find: vi.fn().mockReturnValue({
              toArray: vi.fn().mockResolvedValue(filters.filter((f) => 'priority' in (f.criteria as object))),
            }),
            updateOne,
          },
    ),
  };

  return { db: db as never, tasks, updateMany, dropIndex, updateOne };
}

describe('migrateTaskPriorityToLevel', () => {
  it('backfills LOW/MEDIUM/HIGH/CRITICAL → 0/1/2/3, unsets the old field and drops the legacy index', async () => {
    const docs: MockTask[] = [
      { id: 't1', priority: 'LOW' },
      { id: 't2', priority: 'MEDIUM' },
      { id: 't3', priority: 'HIGH' },
      { id: 't4', priority: 'CRITICAL' },
    ];
    const { db, dropIndex } = createPriorityDb(docs);
    const stats = await migrateTaskPriorityToLevel(db);

    expect(stats.tasksTotal).toBe(4);
    expect(stats.tasksMigrated).toBe(4);
    expect(stats.oldFieldRemoved).toBe(4);
    expect(stats.oldIndexDropped).toBe(true);
    expect(docs.map((d) => d.priorityLevel)).toEqual([0, 1, 2, 3]);
    expect(docs.every((d) => !('priority' in d))).toBe(true);
    // legacy index dropped by name
    expect(dropIndex).toHaveBeenCalledWith('projectId_1_priority_1_number_1');
  });

  it('migrates saved-filter criteria arrays', async () => {
    const filters: MockTask[] = [{ id: 'f1', criteria: { priority: ['HIGH', 'CRITICAL'] } }];
    const { db } = createPriorityDb([{ id: 't1', priority: 'LOW' }], filters);
    const stats = await migrateTaskPriorityToLevel(db);

    expect(stats.filtersMigrated).toBe(1);
    expect(filters[0]?.criteria).toEqual({ priorityLevel: [2, 3] });
  });

  it('refuses to run when a task is missing priority (and does not touch data)', async () => {
    const docs: MockTask[] = [{ id: 't1', priority: 'LOW' }, { id: 't2' }];
    const { db, updateMany } = createPriorityDb(docs);

    await expect(migrateTaskPriorityToLevel(db)).rejects.toThrow(/missing priority/);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('refuses to run on unexpected priority values', async () => {
    const docs: MockTask[] = [{ id: 't1', priority: 'WHATEVER' }];
    const { db, updateMany } = createPriorityDb(docs);

    await expect(migrateTaskPriorityToLevel(db)).rejects.toThrow(/unexpected/);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('is idempotent — a migrated database is a no-op', async () => {
    const docs: MockTask[] = [{ id: 't1', priorityLevel: 2 }];
    const { db, updateMany } = createPriorityDb(docs);
    const stats = await migrateTaskPriorityToLevel(db);

    expect(stats.tasksMigrated).toBe(0);
    expect(stats.oldFieldRemoved).toBe(0);
    // only the legacy-field removal pass ran (matching nothing)
    expect(updateMany).toHaveBeenCalledTimes(5); // 4 no-op backfill passes + the removal pass
  });
});
