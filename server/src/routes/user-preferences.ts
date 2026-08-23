import { Hono } from 'hono';
import type { AppEnv } from '../types/context.js';
import { validateBody } from '../middleware/validation.js';
import { UserPreferencesService } from '../services/user-preferences.service.js';
import { UserPreferencesRepository } from '../repositories/user-preferences.repository.js';
import { BoardRepository } from '../repositories/board.repository.js';
import { getCollection } from '../db/mongo.js';
import type { UserPreferencesDocument } from '../repositories/user-preferences.repository.js';
import type { BoardDocument } from '../repositories/board.repository.js';
import { UpdateUserProjectBoardPreferenceSchema } from '../schemas/user-preferences.js';

// ─── User-Level Settings Document ────────────────────────────────────────────

interface UserSettingsDocument {
  _id?: import('mongodb').ObjectId;
  userId: string;
  zoom: number;
  theme: string;
  language: string;
  pageSize: number;
  updatedAt: Date;
}

export function createUserPreferencesRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  // ── User-level preferences (no tenant context needed) ─────────────────────

  /**
   * GET /preferences — Get current user's global preferences (zoom, theme, language).
   */
  router.get('/preferences', async (c) => {
    const userId = c.get('userId');
    const collection = getCollection<UserSettingsDocument>('user_settings');
    const doc = await collection.findOne({ userId });
    const prefs = doc
      ? {
          userId: doc.userId,
          zoom: doc.zoom,
          theme: doc.theme,
          language: doc.language,
          pageSize: doc.pageSize ?? 10,
          updatedAt: doc.updatedAt.toISOString(),
        }
      : { userId, zoom: 100, theme: 'light', language: 'en', pageSize: 20, updatedAt: new Date().toISOString() };

    return c.json({ data: prefs });
  });

  /**
   * PUT /preferences — Update current user's global preferences.
   */
  router.put('/preferences', async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json<{ zoom?: number; theme?: string; language?: string; pageSize?: number }>();
    const collection = getCollection<UserSettingsDocument>('user_settings');
    const now = new Date();
    const $set: Record<string, unknown> = { updatedAt: now };

    if (body.zoom !== undefined) $set.zoom = body.zoom;
    if (body.theme !== undefined) $set.theme = body.theme;
    if (body.language !== undefined) $set.language = body.language;
    if (body.pageSize !== undefined) $set.pageSize = body.pageSize;

    // $setOnInsert must not contain keys that also appear in $set —
    // MongoDB rejects that with "Updating the path … would create a conflict".
    const $setOnInsert: Record<string, unknown> = { userId };

    if (body.zoom === undefined) $setOnInsert.zoom = 100;
    if (body.theme === undefined) $setOnInsert.theme = 'light';
    if (body.language === undefined) $setOnInsert.language = 'en';
    if (body.pageSize === undefined) $setOnInsert.pageSize = 10;

    await collection.updateOne({ userId }, { $set, $setOnInsert }, { upsert: true });

    const doc = await collection.findOne({ userId });
    const prefs = doc
      ? {
          userId: doc.userId,
          zoom: doc.zoom,
          theme: doc.theme,
          language: doc.language,
          pageSize: doc.pageSize ?? 10,
          updatedAt: doc.updatedAt.toISOString(),
        }
      : { userId, zoom: 100, theme: 'light', language: 'en', pageSize: 10, updatedAt: now.toISOString() };

    return c.json({ data: prefs });
  });

  // ── Project-scoped preferences (requires tenant context) ──────────────────

  /**
   * GET /projects/:projectId/preferences — Get user's project preferences.
   */
  router.get('/projects/:projectId/preferences', async (c) => {
    const projectId = c.req.param('projectId');
    const userId = c.get('userId');
    const service = createPreferencesService();
    const prefs = await service.getPreferences(userId, projectId);

    return c.json({ data: prefs });
  });

  /**
   * PATCH /projects/:projectId/preferences — Update user's project preferences.
   */
  router.patch('/projects/:projectId/preferences', validateBody(UpdateUserProjectBoardPreferenceSchema), async (c) => {
    const projectId = c.req.param('projectId');
    const userId = c.get('userId');
    const body = c.get('validatedBody' as never) as { defaultBoardId: string | null };
    const service = createPreferencesService();
    const prefs = await service.updatePreferences(userId, projectId, body);

    return c.json({ data: prefs });
  });

  return router;
}

function createPreferencesService(): UserPreferencesService {
  const prefsRepo = new UserPreferencesRepository(getCollection<UserPreferencesDocument>('user_preferences'));
  const boardRepo = new BoardRepository(getCollection<BoardDocument>('boards')) as never;

  return new UserPreferencesService(prefsRepo, boardRepo);
}
