import { describe, it, expect, vi } from 'vitest';

vi.mock('../db/mongo.js', () => ({
  getCollection: vi.fn().mockReturnValue({
    findOne: vi.fn(),
    find: vi.fn(),
    insertOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    deleteOne: vi.fn(),
  }),
}));

describe('Sprint Routes', () => {
  it('exports createSprintRoutes function', async () => {
    const mod = await import('./sprints.js');

    expect(typeof mod.createSprintRoutes).toBe('function');
  });
});
