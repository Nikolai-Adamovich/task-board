import { Hono } from 'hono';
import type { AppEnv } from '../types/context.js';
import { validateBody } from '../middleware/validation.js';
import { authMiddleware } from '../middleware/auth.js';
import {
  RegisterRequestSchema,
  LoginRequestSchema,
  AcceptInvitationSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
} from '../schemas/auth.js';

// ─── Auth Routes ─────────────────────────────────────────────────────────────

/**
 * Creates and returns the auth Hono app with all auth-related routes.
 *
 * These routes do NOT require tenant context or RBAC middleware.
 * The /me endpoint requires authentication via the authMiddleware.
 */
export function createAuthRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  /**
   * POST /register — Register a new user account.
   * Returns 201 with { data: { id, email, displayName, avatarUrl } }.
   */
  router.post('/register', validateBody(RegisterRequestSchema), async (c) => {
    const body = c.req.valid('json');
    const clientIp = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
    const result = await c.get('svc').auth.register(body, clientIp);

    return c.json({ data: result }, 201);
  });

  /**
   * POST /login — Authenticate with email and password.
   * Returns 200 with { data: { token, user: { id, email, displayName, avatarUrl } } }.
   */
  router.post('/login', validateBody(LoginRequestSchema), async (c) => {
    const body = c.req.valid('json');
    const clientIp = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
    const result = await c.get('svc').auth.login(body, clientIp);

    return c.json({ data: result }, 200);
  });

  /**
   * POST /accept-invitation — Accept an invitation to join a tenant.
   * Public endpoint — no auth required.
   * Returns 200 with { data: { token, user } }.
   */
  router.post('/accept-invitation', validateBody(AcceptInvitationSchema), async (c) => {
    const body = c.req.valid('json');
    const result = await c.get('svc').auth.acceptInvitation(body);

    return c.json({ data: result }, 200);
  });

  /**
   * GET /invitations/:token — Get invitation details by token.
   * Public endpoint — no auth required.
   * Returns 200 with { data: invitationDetails }.
   */
  router.get('/invitations/:token', async (c) => {
    const token = c.req.param('token');
    const result = await c.get('svc').auth.getInvitationDetails(token);

    return c.json({ data: result }, 200);
  });

  /**
   * POST /forgot-password — Request a password reset link.
   * Public endpoint — no auth required.
   * Anti-enumeration (DEC-023): always responds with the same neutral message,
   * whether or not the email belongs to an existing account.
   * Returns 200 with { data: { message } }.
   */
  router.post('/forgot-password', validateBody(ForgotPasswordSchema), async (c) => {
    const body = c.req.valid('json');
    const clientIp = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
    const result = await c.get('svc').auth.requestPasswordReset(body, clientIp);

    return c.json({ data: result }, 200);
  });

  /**
   * POST /reset-password — Set a new password using a single-use reset token.
   * Public endpoint — no auth required.
   * Unknown/expired/used tokens yield a neutral 400 INVALID_RESET_TOKEN.
   * Returns 200 with { data: { message } }.
   */
  router.post('/reset-password', validateBody(ResetPasswordSchema), async (c) => {
    const body = c.req.valid('json');
    const result = await c.get('svc').auth.resetPassword(body);

    return c.json({ data: result }, 200);
  });

  /**
   * GET /me — Get the currently authenticated user's profile.
   * Returns 200 with { data: user }.
   * Requires Authorization header (authMiddleware).
   */
  router.get('/me', authMiddleware, async (c) => {
    const userId = c.get('userId');
    const user = await c.get('svc').auth.me(userId);

    return c.json({ data: user }, 200);
  });

  return router;
}
