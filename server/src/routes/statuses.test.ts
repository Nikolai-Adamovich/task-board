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

describe('Status Routes', () => {
  it('exports createStatusRoutes function', async () => {
    const mod = await import('./statuses.js');

    expect(typeof mod.createStatusRoutes).toBe('function');
  });

  it('returns a Hono app with routes', async () => {
    const { createStatusRoutes } = await import('./statuses.js');
    const router = createStatusRoutes();

    expect(router).toBeDefined();
    expect(typeof router.fetch).toBe('function');
  });
});
