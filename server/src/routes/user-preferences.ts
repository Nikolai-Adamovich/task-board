import { Hono } from 'hono';
import type { AppEnv } from '../types/context.js';
import { UserPreferencesRepository } from '../repositories/user-preferences.repository.js';
import type { UserPreferencesDocument } from '../repositories/user-preferences.repository.js';
import { UserPreferencesService } from '../services/user-preferences.service.js';
import { getCollection } from '../db/mongo.js';
import { UpdateUserPreferencesSchema } from '@task-board/shared';

// ─── User Preferences Routes ─────────────────────────────────────────────────

/**
 * Creates and returns the user-preferences Hono router.
 *
 * Mount under `/api/v1/users` so that the full paths become:
 *   GET  /api/v1/users/:id/preferences
 *   PUT  /api/v1/users/:id/preferences
 *
 * Both routes require authentication and enforce own-user access only.
 */
export function createUserPreferencesRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  /**
   * GET /:id/preferences — Retrieve the authenticated user's preferences.
   * Returns 403 if the requested id does not match the authenticated user.
   */
  router.get('/:id/preferences', async (c) => {
    const userId = c.get('userId');
    const targetId = c.req.param('id');

    if (userId !== targetId) {
      return c.json({ error: 'Forbidden', message: 'You can only access your own preferences' }, 403);
    }

    const service = createPreferencesService();
    const preferences = await service.getPreferences(userId);

    return c.json(preferences);
  });

  /**
   * PUT /:id/preferences — Upsert the authenticated user's preferences.
   * Validates the request body against `UpdateUserPreferencesSchema`.
   * Returns 400 if validation fails, 403 if the id doesn't match.
   */
  router.put('/:id/preferences', async (c) => {
    const userId = c.get('userId');
    const targetId = c.req.param('id');

    if (userId !== targetId) {
      return c.json({ error: 'Forbidden', message: 'You can only update your own preferences' }, 403);
    }

    let body: unknown;

    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Bad Request', message: 'Invalid JSON in request body' }, 400);
    }

    const parsed = UpdateUserPreferencesSchema.safeParse(body);

    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      }));

      return c.json({ error: 'Bad Request', message: 'Validation failed', details }, 400);
    }

    const service = createPreferencesService();
    const preferences = await service.updatePreferences(userId, parsed.data);

    return c.json(preferences);
  });

  return router;
}

// ─── Factory Helper ──────────────────────────────────────────────────────────

function createPreferencesService(): UserPreferencesService {
  const repo = new UserPreferencesRepository(getCollection<UserPreferencesDocument>('user_preferences'));

  return new UserPreferencesService(repo);
}
