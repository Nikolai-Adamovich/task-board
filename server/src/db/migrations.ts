/**
 * One-shot data migrations for existing databases.
 *
 * Each migration is idempotent: running it against an already-conformed
 * database is a no-op, so it is safe to invoke on every cold start.
 */
import type { Db } from 'mongodb';
import { MemberStatus, InvitationStatus, generateSlugFromName, TENANT_SLUG_MAX_LENGTH } from '@task-board/shared';
import { createLogger } from '../utils/logger.js';

const log = createLogger({ scope: 'migrations' });

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
    log.warn('DEC-018: rewrote invited member(s) to ACCESS_REVOKED', { count: result.modifiedCount });
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
    log.warn('DEC-032: backfilled slug for tenant(s)', { count: updated });
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

/**
 * M-04: run the slug backfill and the unique index creation back-to-back as a
 * single migration step. Invoking them as two separate steps in the startup
 * sequence left a window where a concurrent isolate could insert a duplicate
 * slug between the backfill and the index build.
 */
export async function ensureTenantSlugIntegrity(db: Db): Promise<void> {
  await backfillTenantSlugs(db);
  await ensureTenantSlugUniqueIndex(db);
}

// ─── DEC-055 Migration ───────────────────────────────────────────────────────

/**
 * Backfill the tenant-member `expiresAt` field (DEC-055).
 *
 * Members created before the field existed have no `expiresAt`; the domain
 * contract is `Date | null`, so legacy documents are set to `null`
 * (= never expires). Idempotent: only documents missing the field are
 * touched. Returns the number of backfilled documents.
 */
export async function backfillMemberExpiresAt(db: Db): Promise<number> {
  const result = await db
    .collection('tenant_members')
    .updateMany({ expiresAt: { $exists: false } }, { $set: { expiresAt: null } });

  if (result.modifiedCount > 0) {
    log.warn('DEC-055: backfilled expiresAt on member document(s)', { count: result.modifiedCount });
  }

  return result.modifiedCount;
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
    log.warn('DR-1: renamed seed status(es) to human-readable names', { count: updated });
  }

  return updated;
}

// ─── Core Indexes ────────────────────────────────────────────────────────────

interface IndexDefinition {
  collection: string;
  spec: Record<string, 1 | -1>;
  options?: { unique?: boolean };
}

/**
 * Every index required by the repositories, created programmatically.
 *
 * Repository file headers document these indexes, but before this function
 * nothing created them — new environments silently ran with full collection
 * scans and no uniqueness enforcement (e.g. `users.email`: the check-then-insert
 * registration flow races into duplicate accounts without it).
 */
const CORE_INDEXES: IndexDefinition[] = [
  // users
  { collection: 'users', spec: { id: 1 }, options: { unique: true } },
  { collection: 'users', spec: { email: 1 }, options: { unique: true } },
  // tenants ({ slug: 1 } unique is handled by ensureTenantSlugUniqueIndex)
  { collection: 'tenants', spec: { id: 1 }, options: { unique: true } },
  // tenant_members
  { collection: 'tenant_members', spec: { id: 1 }, options: { unique: true } },
  { collection: 'tenant_members', spec: { tenantId: 1, userId: 1 }, options: { unique: true } },
  { collection: 'tenant_members', spec: { tenantId: 1 } },
  { collection: 'tenant_members', spec: { 'invitation.tokenHash': 1 } },
  { collection: 'tenant_members', spec: { 'invitation.invitedEmail': 1 } },
  // projects
  { collection: 'projects', spec: { id: 1 }, options: { unique: true } },
  { collection: 'projects', spec: { tenantId: 1, key: 1 }, options: { unique: true } },
  // project_members
  { collection: 'project_members', spec: { id: 1 }, options: { unique: true } },
  { collection: 'project_members', spec: { projectId: 1, userId: 1 }, options: { unique: true } },
  // tasks
  { collection: 'tasks', spec: { id: 1 }, options: { unique: true } },
  { collection: 'tasks', spec: { projectId: 1, number: -1 }, options: { unique: true } },
  { collection: 'tasks', spec: { projectId: 1, createdAt: -1 } },
  { collection: 'tasks', spec: { projectId: 1, updatedAt: -1 } },
  { collection: 'tasks', spec: { projectId: 1, statusId: 1 } },
  { collection: 'tasks', spec: { projectId: 1, sprintId: 1 } },
  { collection: 'tasks', spec: { projectId: 1, assigneeId: 1 } },
  // S-15: label filter queries (`labelIds` array) — multikey index
  { collection: 'tasks', spec: { projectId: 1, labelIds: 1 } },
  // comments
  { collection: 'comments', spec: { taskId: 1 } },
  // task_relationships
  { collection: 'task_relationships', spec: { projectId: 1 } },
  { collection: 'task_relationships', spec: { sourceTaskId: 1 } },
  { collection: 'task_relationships', spec: { targetTaskId: 1 } },
  // audit_events
  { collection: 'audit_events', spec: { tenantId: 1, createdAt: -1 } },
  { collection: 'audit_events', spec: { projectId: 1, createdAt: -1 } },
  // S-15: entity/action drill-down filters on the audit log
  { collection: 'audit_events', spec: { projectId: 1, entityType: 1, createdAt: -1 } },
  { collection: 'audit_events', spec: { projectId: 1, action: 1, createdAt: -1 } },
  // filters
  { collection: 'filters', spec: { userId: 1, projectId: 1 } },
  // labels
  { collection: 'labels', spec: { projectId: 1 } },
  // statuses
  { collection: 'statuses', spec: { id: 1 }, options: { unique: true } },
  { collection: 'statuses', spec: { projectId: 1, normalizedName: 1 }, options: { unique: true } },
  // task_types
  { collection: 'task_types', spec: { id: 1 }, options: { unique: true } },
  { collection: 'task_types', spec: { projectId: 1, key: 1 }, options: { unique: true } },
  // boards
  { collection: 'boards', spec: { id: 1 }, options: { unique: true } },
  { collection: 'boards', spec: { projectId: 1 } },
  // sprints
  { collection: 'sprints', spec: { id: 1 }, options: { unique: true } },
  { collection: 'sprints', spec: { projectId: 1, status: 1 } },
  // user_preferences / user_settings
  { collection: 'user_preferences', spec: { userId: 1, projectId: 1 }, options: { unique: true } },
  { collection: 'user_settings', spec: { userId: 1 }, options: { unique: true } },
];

/**
 * Create all core indexes (idempotent — `createIndex` is a no-op for an
 * existing identical index).
 *
 * Indexes are created independently: a failure on one (e.g. a unique index
 * conflicting with pre-existing duplicate documents) is logged and does not
 * block the remaining indexes or the API request.
 */
export async function ensureCoreIndexes(db: Db): Promise<void> {
  await Promise.all(
    CORE_INDEXES.map(async ({ collection, spec, options }) => {
      try {
        await db.collection(collection).createIndex(spec, options);
      } catch (err) {
        log.error('Failed to create index', { collection, spec, err });
      }
    }),
  );
}

/**
 * Idempotent data migrations, executed by `server/scripts/migrate.ts` (from
 * CD before the Worker deploy, or locally) — NEVER in the Worker request
 * path. M-04: the slug backfill and the unique slug index are a single step
 * — splitting them left a window where a concurrent run could insert a
 * duplicate slug in between.
 */
export async function runMigrations(db: Db): Promise<void> {
  await migrateInvitedMembershipsToRevoked(db);
  await renameSeedStatusNames(db); // DR-1 — raw seed-status keys → display names
  await ensureTenantSlugIntegrity(db); // DEC-032 — backfill + unique index back-to-back
  await backfillMemberExpiresAt(db); // DEC-055 — expiresAt: null on legacy members
  await ensureCoreIndexes(db); // create every repository-documented index (idempotent)
}
