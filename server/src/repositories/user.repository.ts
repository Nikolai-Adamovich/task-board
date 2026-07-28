import { randomUUID } from 'node:crypto';
import type { Collection } from 'mongodb';
import type { User } from '@task-board/shared';

// ─── MongoDB Document Shape ───────────────────────────────────────────────────

export interface UserDocument {
  _id?: import('mongodb').ObjectId;
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Mapper ──────────────────────────────────────────────────────────────────

function toDomain(doc: UserDocument): User {
  return {
    id: doc.id,
    email: doc.email,
    displayName: doc.displayName,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

// ─── User Repository ─────────────────────────────────────────────────────────

export class UserRepository {
  constructor(private readonly collection: Collection<UserDocument>) {}

  async findById(id: string): Promise<User | null> {
    const doc = await this.collection.findOne({ id });
    return doc ? toDomain(doc) : null;
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.collection.findOne({ email });
  }

  async create(input: { email: string; displayName: string; passwordHash: string }): Promise<User> {
    const now = new Date();
    const doc: UserDocument = {
      id: randomUUID(),
      email: input.email,
      displayName: input.displayName,
      passwordHash: input.passwordHash,
      createdAt: now,
      updatedAt: now,
    };

    await this.collection.insertOne(doc);
    return toDomain(doc);
  }
}
