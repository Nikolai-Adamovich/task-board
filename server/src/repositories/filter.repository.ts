import { BaseRepository } from './base.repository.js';
import { randomUUID } from 'node:crypto';
import type { Filter, FilterCriteria, FilterSort } from '@task-board/shared';

export interface FilterDocument {
  _id?: import('mongodb').ObjectId;
  id: string;
  projectId: string;
  userId: string;
  name: string;
  filters: FilterCriteria;
  sort: FilterSort;
  createdAt: Date;
  updatedAt: Date;
}

function toDomain(doc: FilterDocument): Filter {
  return {
    id: doc.id,
    projectId: doc.projectId,
    userId: doc.userId,
    name: doc.name,
    filters: doc.filters,
    sort: doc.sort,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export class FilterRepository extends BaseRepository<FilterDocument, Filter> {
  protected toDomain(doc: FilterDocument): Filter {
    return toDomain(doc);
  }

  async findByUserAndProject(userId: string, projectId: string): Promise<Filter[]> {
    const docs = await this.collection.find({ userId, projectId }).toArray();

    return docs.map(toDomain);
  }

  async findByUserProjectAndName(userId: string, projectId: string, name: string): Promise<Filter | null> {
    const doc = await this.collection.findOne({ userId, projectId, name });

    return doc ? toDomain(doc) : null;
  }

  async create(input: {
    projectId: string;
    userId: string;
    name: string;
    filters: FilterCriteria;
    sort: FilterSort;
  }): Promise<Filter> {
    const now = new Date();
    const doc: FilterDocument = {
      id: randomUUID(),
      ...input,
      createdAt: now,
      updatedAt: now,
    };

    await this.collection.insertOne(doc);
    return toDomain(doc);
  }

  async update(id: string, input: Partial<Pick<FilterDocument, 'name' | 'filters' | 'sort'>>): Promise<Filter | null> {
    const result = await this.collection.findOneAndUpdate(
      { id },
      { $set: { ...input, updatedAt: new Date() } },
      { returnDocument: 'after' },
    );

    return result ? toDomain(result) : null;
  }

  /**
   * Delete all entities belonging to a project. Used for cascade delete.
   */
  async deleteByProject(projectId: string): Promise<void> {
    await this.collection.deleteMany({ projectId });
  }
}
