/**
 * One-shot data migrations for existing databases.
 *
 * Each migration is idempotent: running it against an already-conformed
 * database is a no-op, so it is safe to invoke on every cold start.
 */
import type { Db } from 'mongodb';
import { MemberStatus, InvitationStatus, generateSlugFromName, TENANT_SLUG_MAX_LENGTH } from '@task-board/shared';

// ─── DEC-018 Migration ───────────────────────────────────────────────────────

/**
 * Rewrite invited memberships created under the old semantics.
 *
 * Before DEC-018 an invited member was stored as `status = ACTIVE` with an
 * embedded PENDING invitation (the invitation tracked the pending state).
 * Under DEC-018 the membership itself must be `ACCESS_REVOKED` until the
 * invitee explicitly accepts.
 *
 * Matches docs with `invitation.status = 'PENDING'` and `status = 'ACTIVE'`
 * and flips them to `ACCESS_REVOKED`. Returns the number of rewritten docs.
 */
export async function migrateInvitedMembershipsToRevoked(db: Db): Promise<number> {
  const result = await db
    .collection('tenant_members')
    .updateMany(
      { status: MemberStatus.ACTIVE, 'invitation.status': InvitationStatus.PENDING },
      { $set: { status: MemberStatus.ACCESS_REVOKED } },
    );

  if (result.modifiedCount > 0) {
    console.warn(`[migrations] DEC-018: rewrote ${result.modifiedCount} invited member(s) to ACCESS_REVOKED`);
  }

  return result.modifiedCount;
}

// ─── DEC-032 Migrations ──────────────────────────────────────────────────────

interface TenantBackfillDocument {
  _id: import('mongodb').ObjectId;
  name?: string;
  slug?: string | null;
}

/**
 * Truncate a base slug so that the `-<n>` collision suffix still fits within
 * the max slug length (never ending on a hyphen).
 */
function withSuffix(base: string, n: number): string {
  const suffix = `-${n}`;
  const body = base.slice(0, TENANT_SLUG_MAX_LENGTH - suffix.length).replace(/-+$/, '');

  return `${body}${suffix}`;
}

/**
 * Backfill the tenant `slug` field for tenants created before DEC-032.
 *
 * The slug is generated from the tenant name; on collision a numeric suffix
 * is appended (`-2`, `-3`, …). Idempotent: only documents missing a slug are
 * touched, so re-running against a conformed database is a no-op.
 *
 * Returns the number of backfilled tenants. Must run BEFORE
 * {@link ensureTenantSlugUniqueIndex} on first deployment.
 */
export async function backfillTenantSlugs(db: Db): Promise<number> {
  const tenants = db.collection<TenantBackfillDocument>('tenants');
  const missing = await tenants.find({ $or: [{ slug: { $exists: false } }, { slug: null }] }).toArray();
  let updated = 0;

  for (const doc of missing) {
    const base = generateSlugFromName(doc.name ?? '') || 'workspace';
    let candidate = base;
    let n = 1;

    while (await tenants.findOne({ slug: candidate })) {
      n += 1;
      candidate = withSuffix(base, n);
    }

    await tenants.updateOne({ _id: doc._id }, { $set: { slug: candidate } });
    updated += 1;
  }

  if (updated > 0) {
    console.warn(`[migrations] DEC-032: backfilled slug for ${updated} tenant(s)`);
  }

  return updated;
}

/**
 * Create the global unique index on `{ slug: 1 }` (DEC-032).
 *
 * `createIndex` is idempotent — an existing identical index is a no-op.
 * Run {@link backfillTenantSlugs} first so legacy rows cannot violate the
 * uniqueness constraint during index build.
 */
export async function ensureTenantSlugUniqueIndex(db: Db): Promise<void> {
  await db.collection('tenants').createIndex({ slug: 1 }, { unique: true });
}

// ─── DR-1 Migration ──────────────────────────────────────────────────────────

/**
 * Raw seed-status keys → human-readable display names (DR-1).
 * Keyed by normalizedName so only the original seed statuses are touched —
 * user-created or user-renamed statuses are never modified.
 */
const SEED_STATUS_NAME_MAP: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  reopened: 'Reopened',
  done: 'Done',
};

/**
 * Rename seed statuses that still carry their raw enum keys as display names
 * (`TODO` → `To Do`, `IN_PROGRESS` → `In Progress`, …).
 *
 * Matches by `normalizedName` AND exact raw-key `name`, so it is idempotent:
 * already-renamed or custom-named statuses never match. Returns the number of
 * renamed documents.
 */
export async function renameSeedStatusNames(db: Db): Promise<number> {
  const statuses = db.collection('statuses');
  let updated = 0;

  for (const [normalizedName, displayName] of Object.entries(SEED_STATUS_NAME_MAP)) {
    const result = await statuses.updateMany(
      { normalizedName, name: normalizedName.toUpperCase() },
      { $set: { name: displayName, updatedAt: new Date() } },
    );

    updated += result.modifiedCount;
  }

  if (updated > 0) {
    console.warn(`[migrations] DR-1: renamed ${updated} seed status(es) to human-readable names`);
  }

  return updated;
}
