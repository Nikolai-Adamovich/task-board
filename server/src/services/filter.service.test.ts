import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FilterService } from './filter.service.js';
import { FilterRepository } from '../repositories/filter.repository.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../errors/app-error.js';
import type { CreateFilter, Filter } from '@task-board/shared';

// ─── Mock Factories ──────────────────────────────────────────────────────────

function createMockFilterRepo() {
  return {
    findByUserAndProject: vi.fn(),
    findByUserProjectAndName: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as unknown as FilterRepository;
}

function makeFilter(overrides: Partial<Filter> = {}): Filter {
  return {
    id: 'filter-1',
    projectId: 'project-1',
    userId: 'user-1',
    name: 'My Open Tasks',
    filters: { statusIds: ['status-1'] },
    sort: { field: 'createdAt', direction: 'desc' },
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  } as Filter;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('FilterService', () => {
  let filterRepo: ReturnType<typeof createMockFilterRepo>;
  let projectRepo: { findById: ReturnType<typeof vi.fn> };
  let service: FilterService;

  beforeEach(() => {
    filterRepo = createMockFilterRepo();
    projectRepo = { findById: vi.fn().mockResolvedValue({ id: 'project-1', tenantId: 'tenant-1' }) };
    service = new FilterService(filterRepo, projectRepo as never);
  });

  describe('getFiltersByUserAndProject', () => {
    it('returns all filters for the user and project', async () => {
      const filters = [makeFilter(), makeFilter({ id: 'filter-2', name: 'Assigned to me' })];

      filterRepo.findByUserAndProject = vi.fn().mockResolvedValue(filters);

      const result = await service.getFiltersByUserAndProject('user-1', 'project-1', 'tenant-1');

      expect(result).toHaveLength(2);
      expect(filterRepo.findByUserAndProject).toHaveBeenCalledWith('user-1', 'project-1');
    });

    it('throws NOT_FOUND (not 403) when the project belongs to another tenant (M-02)', async () => {
      projectRepo.findById = vi.fn().mockResolvedValue({ id: 'project-1', tenantId: 'tenant-OTHER' });

      await expect(service.getFiltersByUserAndProject('user-1', 'project-1', 'tenant-1')).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
      expect(filterRepo.findByUserAndProject).not.toHaveBeenCalled();
    });
  });

  describe('createFilter', () => {
    const input: CreateFilter = {
      name: 'My Open Tasks',
      filters: { statusIds: ['status-1'] },
      sort: { field: 'createdAt', direction: 'desc' },
    };

    it('creates a filter when the name is free', async () => {
      filterRepo.findByUserProjectAndName = vi.fn().mockResolvedValue(null);
      filterRepo.create = vi.fn().mockResolvedValue(makeFilter());

      const result = await service.createFilter('user-1', 'project-1', input);

      expect(result.name).toBe('My Open Tasks');
      expect(filterRepo.create).toHaveBeenCalledWith({
        projectId: 'project-1',
        userId: 'user-1',
        name: 'My Open Tasks',
        filters: { statusIds: ['status-1'] },
        sort: { field: 'createdAt', direction: 'desc' },
      });
    });

    it('throws ConflictError when a filter with the same name exists', async () => {
      filterRepo.findByUserProjectAndName = vi.fn().mockResolvedValue(makeFilter());

      await expect(service.createFilter('user-1', 'project-1', input)).rejects.toThrow(ConflictError);
      expect(filterRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('updateFilter', () => {
    const input = { name: 'Renamed Filter' };

    it('updates a filter owned by the caller', async () => {
      filterRepo.findById = vi.fn().mockResolvedValue(makeFilter());
      filterRepo.update = vi.fn().mockResolvedValue(makeFilter({ name: 'Renamed Filter' }));

      const result = await service.updateFilter('filter-1', 'user-1', input);

      expect(result.name).toBe('Renamed Filter');
      expect(filterRepo.update).toHaveBeenCalledWith('filter-1', input);
    });

    it('throws NotFoundError when the filter does not exist', async () => {
      filterRepo.findById = vi.fn().mockResolvedValue(null);

      await expect(service.updateFilter('missing', 'user-1', input)).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when the filter belongs to another user', async () => {
      filterRepo.findById = vi.fn().mockResolvedValue(makeFilter({ userId: 'someone-else' }));

      await expect(service.updateFilter('filter-1', 'user-1', input)).rejects.toThrow(ForbiddenError);
      expect(filterRepo.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when the update returns null', async () => {
      filterRepo.findById = vi.fn().mockResolvedValue(makeFilter());
      filterRepo.update = vi.fn().mockResolvedValue(null);

      await expect(service.updateFilter('filter-1', 'user-1', input)).rejects.toThrow(NotFoundError);
    });
  });

  describe('deleteFilter', () => {
    it('deletes a filter owned by the caller', async () => {
      filterRepo.findById = vi.fn().mockResolvedValue(makeFilter());
      filterRepo.delete = vi.fn().mockResolvedValue(undefined);

      await expect(service.deleteFilter('filter-1', 'user-1')).resolves.toBeUndefined();
      expect(filterRepo.delete).toHaveBeenCalledWith('filter-1');
    });

    it('throws NotFoundError when the filter does not exist', async () => {
      filterRepo.findById = vi.fn().mockResolvedValue(null);

      await expect(service.deleteFilter('missing', 'user-1')).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when the filter belongs to another user', async () => {
      filterRepo.findById = vi.fn().mockResolvedValue(makeFilter({ userId: 'someone-else' }));

      await expect(service.deleteFilter('filter-1', 'user-1')).rejects.toThrow(ForbiddenError);
      expect(filterRepo.delete).not.toHaveBeenCalled();
    });
  });
});
