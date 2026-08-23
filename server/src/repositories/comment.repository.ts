import { randomUUID } from 'node:crypto';
import type { Collection } from 'mongodb';
import type { Comment, IdentitySnapshot } from '@task-board/shared';

export interface CommentDocument {
  _id?: import('mongodb').ObjectId;
  id: string;
  taskId: string;
  authorId: string;
  authorSnapshot: IdentitySnapshot;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

function toDomain(doc: CommentDocument): Comment {
  return {
    id: doc.id,
    taskId: doc.taskId,
    authorId: doc.authorId,
    authorSnapshot: doc.authorSnapshot,
    body: doc.body,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export class CommentRepository {
  constructor(private readonly collection: Collection<CommentDocument>) {}

  async findById(id: string): Promise<Comment | null> {
    const doc = await this.collection.findOne({ id });

    return doc ? toDomain(doc) : null;
  }

  async findByTask(taskId: string): Promise<Comment[]> {
    const docs = await this.collection.find({ taskId }).sort({ createdAt: 1 }).toArray();

    return docs.map(toDomain);
  }

  async create(input: {
    taskId: string;
    authorId: string;
    authorSnapshot: IdentitySnapshot;
    body: string;
  }): Promise<Comment> {
    const now = new Date();
    const doc: CommentDocument = {
      id: randomUUID(),
      taskId: input.taskId,
      authorId: input.authorId,
      authorSnapshot: input.authorSnapshot,
      body: input.body,
      createdAt: now,
      updatedAt: now,
    };

    await this.collection.insertOne(doc);
    return toDomain(doc);
  }

  async update(id: string, input: { body: string }): Promise<Comment | null> {
    const result = await this.collection.findOneAndUpdate(
      { id },
      { $set: { body: input.body, updatedAt: new Date() } },
      { returnDocument: 'after' },
    );

    return result ? toDomain(result) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ id });

    return result.deletedCount > 0;
  }

  async deleteByTask(taskId: string): Promise<void> {
    await this.collection.deleteMany({ taskId });
  }

  /**
   * Delete all entities belonging to a project. Used for cascade delete.
   */
  async deleteByProject(projectId: string): Promise<void> {
    await this.collection.deleteMany({ projectId });
  }
}
