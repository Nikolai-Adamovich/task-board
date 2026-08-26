import { randomUUID } from 'node:crypto';
import type { Collection } from 'mongodb';
import type { User } from '@task-board/shared';

// Required MongoDB indexes:
// - { id: 1 } (unique)
// - { email: 1 } (unique)

// ─── MongoDB Document Shape ───────────────────────────────────────────────────

export interface UserDocument {
  _id?: import('mongodb').ObjectId;
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  passwordHash: string;
  /** Pending password-reset request: SHA-256 token hash + request time (null when no request is pending) */
  passwordReset?: { tokenHash: string; requestedOn: Date } | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

// ─── Mapper ──────────────────────────────────────────────────────────────────

function toDomain(doc: UserDocument): User {
  return {
    id: doc.id,
    email: doc.email,
    displayName: doc.displayName,
    avatarUrl: doc.avatarUrl,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    deletedAt: doc.deletedAt ? doc.deletedAt.toISOString() : null,
  };
}

/** Normalize email: lowercase + trim */
function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

// ─── User Repository ─────────────────────────────────────────────────────────

export class UserRepository {
  constructor(private readonly collection: Collection<UserDocument>) {}

  async findById(id: string): Promise<User | null> {
    const doc = await this.collection.findOne({ id, deletedAt: null });

    return doc ? toDomain(doc) : null;
  }

  /**
   * Bulk lookup by ids — single `$in` query. Used by batch enrichment paths
   * (e.g. audit-log label resolution) to avoid N+1 per-event lookups.
   */
  async findByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) return [];

    const docs = await this.collection.find({ id: { $in: ids }, deletedAt: null }).toArray();

    return docs.map(toDomain);
  }

  /** Find a user by ID including soft-deleted users */
  async findByIdIncludingDeleted(id: string): Promise<User | null> {
    const doc = await this.collection.findOne({ id });

    return doc ? toDomain(doc) : null;
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.collection.findOne({ email: normalizeEmail(email) });
  }

  /**
   * Find a non-deleted user document (incl. `passwordHash`) by ID.
   * Needed to distinguish real accounts from invitation placeholders
   * (V5-2: placeholder users carry an empty passwordHash).
   */
  async findDocumentById(id: string): Promise<UserDocument | null> {
    return this.collection.findOne({ id, deletedAt: null });
  }

  /**
   * V5-2: turn an invitation-placeholder account into a real one —
   * set the password hash and display name chosen during accept-with-invite.
   */
  async setPasswordAndDisplayName(id: string, passwordHash: string, displayName: string): Promise<void> {
    await this.collection.updateOne(
      { id, deletedAt: null },
      { $set: { passwordHash, displayName, updatedAt: new Date() } },
    );
  }

  async create(input: { email: string; displayName: string; passwordHash: string }): Promise<User> {
    const now = new Date();
    const doc: UserDocument = {
      id: randomUUID(),
      email: normalizeEmail(input.email),
      displayName: input.displayName,
      avatarUrl: null,
      passwordHash: input.passwordHash,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    await this.collection.insertOne(doc);
    return toDomain(doc);
  }

  /** Soft-delete a user by setting deletedAt */
  async softDelete(id: string): Promise<boolean> {
    const result = await this.collection.updateOne({ id, deletedAt: null }, { $set: { deletedAt: new Date() } });

    return result.modifiedCount > 0;
  }

  // ─── Password reset ───────────────────────────────────────────────────────

  /**
   * Find a non-deleted user by email (for password-reset lookups).
   * Soft-deleted users are never matchable.
   */
  async findActiveByEmail(email: string): Promise<UserDocument | null> {
    return this.collection.findOne({ email: normalizeEmail(email), deletedAt: null });
  }

  /** Find a non-deleted user by pending password-reset token hash. */
  async findByPasswordResetToken(tokenHash: string): Promise<UserDocument | null> {
    return this.collection.findOne({ 'passwordReset.tokenHash': tokenHash, deletedAt: null });
  }

  /** Store a hashed reset token and its request time, replacing any previous request. */
  async setPasswordReset(id: string, tokenHash: string, requestedOn: Date): Promise<void> {
    await this.collection.updateOne(
      { id, deletedAt: null },
      { $set: { passwordReset: { tokenHash, requestedOn }, updatedAt: new Date() } },
    );
  }

  /** Set a new password hash and clear the single-use reset token. */
  async updatePasswordAndClearReset(id: string, passwordHash: string): Promise<void> {
    await this.collection.updateOne(
      { id, deletedAt: null },
      { $set: { passwordHash, updatedAt: new Date() }, $unset: { passwordReset: '' } },
    );
  }
}
