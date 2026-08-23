import { describe, it, expect, vi } from 'vitest';

// ─── Mock Modules ────────────────────────────────────────────────────────────

vi.mock('../db/mongo.js', () => ({
  getCollection: vi.fn().mockReturnValue({
    findOne: vi.fn(),
    find: vi.fn(),
    insertOne: vi.fn(),
    insertMany: vi.fn(),
    findOneAndUpdate: vi.fn(),
    deleteOne: vi.fn(),
    countDocuments: vi.fn(),
  }),
}));

describe('TaskType Routes', () => {
  it('exports createTaskTypeRoutes function', async () => {
    const mod = await import('./task-types.js');

    expect(typeof mod.createTaskTypeRoutes).toBe('function');
  });

  it('returns a Hono app with routes', async () => {
    const { createTaskTypeRoutes } = await import('./task-types.js');
    const router = createTaskTypeRoutes();

    expect(router).toBeDefined();
    expect(typeof router.fetch).toBe('function');
  });
});
