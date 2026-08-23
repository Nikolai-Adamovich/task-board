import type { Filter, CreateFilter, UpdateFilter } from '@task-board/shared';
import { ConflictError, ForbiddenError, NotFoundError } from '../errors/app-error.js';
import { FilterRepository } from '../repositories/filter.repository.js';

export class FilterService {
  constructor(private readonly filterRepo: FilterRepository) {}

  async getFiltersByUserAndProject(userId: string, projectId: string): Promise<Filter[]> {
    return this.filterRepo.findByUserAndProject(userId, projectId);
  }

  async createFilter(userId: string, projectId: string, input: CreateFilter): Promise<Filter> {
    const existing = await this.filterRepo.findByUserProjectAndName(userId, projectId, input.name);

    if (existing) {
      throw new ConflictError('A filter with this name already exists for this project');
    }

    return this.filterRepo.create({
      projectId,
      userId,
      name: input.name,
      filters: input.filters,
      sort: input.sort,
    });
  }

  async updateFilter(filterId: string, userId: string, input: UpdateFilter): Promise<Filter> {
    const filter = await this.filterRepo.findById(filterId);

    if (!filter) {
      throw new NotFoundError('Filter not found');
    }

    if (filter.userId !== userId) {
      throw new ForbiddenError('You can only edit your own filters');
    }

    const updated = await this.filterRepo.update(filterId, input);

    if (!updated) {
      throw new NotFoundError('Filter not found');
    }

    return updated;
  }

  async deleteFilter(filterId: string, userId: string): Promise<void> {
    const filter = await this.filterRepo.findById(filterId);

    if (!filter) {
      throw new NotFoundError('Filter not found');
    }

    if (filter.userId !== userId) {
      throw new ForbiddenError('You can only delete your own filters');
    }

    await this.filterRepo.delete(filterId);
  }
}
