import { Hono } from 'hono';
import type { AppEnv } from '../types/context.js';
import { validateBody } from '../middleware/validation.js';
import { UpdateUserGlobalSettingsSchema, UpdateUserProjectBoardPreferenceSchema } from '../schemas/user-preferences.js';

// ─── User Preferences Routes ─────────────────────────────────────────────────

export function createUserPreferencesRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  // ── User-level preferences (no tenant context needed) ─────────────────────

  /**
   * GET /preferences — Get current user's global preferences (zoom, theme, language).
   */
  router.get('/preferences', async (c) => {
    const userId = c.get('userId');
    const prefs = await c.get('svc').preferences.getGlobalSettings(userId);

    return c.json({ data: prefs });
  });

  /**
   * PUT /preferences — Update current user's global preferences.
   */
  router.put('/preferences', validateBody(UpdateUserGlobalSettingsSchema), async (c) => {
    const userId = c.get('userId');
    const body = c.req.valid('json');
    const prefs = await c.get('svc').preferences.updateGlobalSettings(userId, body);

    return c.json({ data: prefs });
  });

  // ── Project-scoped preferences (requires tenant context) ──────────────────

  /**
   * GET /projects/:projectId/preferences — Get user's project preferences.
   */
  router.get('/projects/:projectId/preferences', async (c) => {
    const projectId = c.req.param('projectId');
    const userId = c.get('userId');
    const prefs = await c.get('svc').preferences.getPreferences(userId, projectId);

    return c.json({ data: prefs });
  });

  /**
   * PATCH /projects/:projectId/preferences — Update user's project preferences.
   */
  router.patch('/projects/:projectId/preferences', validateBody(UpdateUserProjectBoardPreferenceSchema), async (c) => {
    const projectId = c.req.param('projectId');
    const userId = c.get('userId');
    const body = c.req.valid('json');
    const prefs = await c.get('svc').preferences.updatePreferences(userId, projectId, body);

    return c.json({ data: prefs });
  });

  return router;
}
