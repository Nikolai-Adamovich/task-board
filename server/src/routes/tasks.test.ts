import { describe, it, expect, vi } from 'vitest';

vi.mock('../db/mongo.js', () => ({
  getCollection: vi.fn().mockReturnValue({
    findOne: vi.fn(),
    find: vi.fn(),
    insertOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    deleteOne: vi.fn(),
    updateMany: vi.fn(),
    countDocuments: vi.fn(),
  }),
}));

describe('Task Routes', () => {
  it('exports createTaskRoutes function', async () => {
    const mod = await import('./tasks.js');

    expect(typeof mod.createTaskRoutes).toBe('function');
  });
});
