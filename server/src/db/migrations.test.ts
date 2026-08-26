/**
 * Tests for idempotent data migrations.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  migrateInvitedMembershipsToRevoked,
  renameSeedStatusNames,
  backfillTenantSlugs,
  ensureTenantSlugUniqueIndex,
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
