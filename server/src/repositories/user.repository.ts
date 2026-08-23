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

  /** Find a user by ID including soft-deleted users */
  async findByIdIncludingDeleted(id: string): Promise<User | null> {
    const doc = await this.collection.findOne({ id });

    return doc ? toDomain(doc) : null;
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.collection.findOne({ email: normalizeEmail(email) });
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
}
