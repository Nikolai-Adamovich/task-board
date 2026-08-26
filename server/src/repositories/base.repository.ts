import type { Collection, Filter } from 'mongodb';

/**
 * Shared CRUD plumbing for repositories backed by an `id`-keyed collection.
 *
 * Concrete repositories extend this class and only implement {@link toDomain}
 * plus their specialized queries — `findById` / `delete` come for free.
 */
export abstract class BaseRepository<TDoc extends { id: string }, TDomain> {
  constructor(protected readonly collection: Collection<TDoc>) {}

  protected abstract toDomain(doc: TDoc): TDomain;

  async findById(id: string): Promise<TDomain | null> {
    // Filter/WithId variance workaround for generic document types
    const doc = (await this.collection.findOne({ id } as Filter<TDoc>)) as TDoc | null;

    return doc ? this.toDomain(doc) : null;
  }

  /**
   * Bulk lookup by ids — single `$in` query. Used by batch enrichment paths
   * (e.g. audit-log label resolution) to avoid N+1 per-event lookups.
   */
  async findByIds(ids: string[]): Promise<TDomain[]> {
    if (ids.length === 0) return [];

    const docs = (await this.collection.find({ id: { $in: ids } } as Filter<TDoc>).toArray()) as TDoc[];

    return docs.map((doc) => this.toDomain(doc));
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ id } as Filter<TDoc>);

    return result.deletedCount > 0;
  }
}
