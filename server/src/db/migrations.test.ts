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
