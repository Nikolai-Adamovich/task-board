import { describe, it, expect, vi } from 'vitest';

vi.mock('../db/mongo.js', () => ({
  getCollection: vi.fn().mockReturnValue({
    findOne: vi.fn(),
    find: vi.fn(),
    insertOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    deleteOne: vi.fn(),
    updateMany: vi.fn(),
  }),
}));

describe('Board Routes', () => {
  it('exports createBoardRoutes function', async () => {
    const mod = await import('./boards.js');

    expect(typeof mod.createBoardRoutes).toBe('function');
  });
});
