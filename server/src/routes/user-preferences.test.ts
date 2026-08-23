import { describe, it, expect, vi } from 'vitest';

vi.mock('../db/mongo.js', () => ({
  getCollection: vi.fn().mockReturnValue({
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
  }),
}));

describe('User Preferences Routes', () => {
  it('exports createUserPreferencesRoutes function', async () => {
    const mod = await import('./user-preferences.js');

    expect(typeof mod.createUserPreferencesRoutes).toBe('function');
  });
});
