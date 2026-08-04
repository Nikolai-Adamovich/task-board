import { Hono } from 'hono';
import type { AppEnv } from '../types/context.js';
import { validateBody } from '../middleware/validation.js';
import { authMiddleware } from '../middleware/auth.js';
import { AuthService } from '../services/auth.service.js';
import { UserRepository } from '../repositories/user.repository.js';
import { TenantRepository } from '../repositories/tenant.repository.js';
import { TenantMemberRepository } from '../repositories/tenant-member.repository.js';
import { getCollection } from '../db/mongo.js';
import type { UserDocument } from '../repositories/user.repository.js';
import type { TenantDocument } from '../repositories/tenant.repository.js';
import type { TenantMemberDocument } from '../repositories/tenant-member.repository.js';
import { RegisterRequestSchema, LoginRequestSchema, AcceptInvitationSchema } from '../schemas/auth.js';

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
   * Returns 201 with { token, user }.
   */
  router.post('/register', validateBody(RegisterRequestSchema), async (c) => {
    const body = c.get('validatedBody' as never) as {
      email: string;
      password: string;
      displayName: string;
    };
    const service = createAuthService(c);
    const result = await service.register(body);

    return c.json(result, 201);
  });

  /**
   * POST /login — Authenticate with email and password.
   * Returns 200 with { token, user }.
   */
  router.post('/login', validateBody(LoginRequestSchema), async (c) => {
    const body = c.get('validatedBody' as never) as {
      email: string;
      password: string;
    };
    const service = createAuthService(c);
    const result = await service.login(body);

    return c.json(result, 200);
  });

  /**
   * POST /accept-invitation — Accept an invitation to join a tenant.
   * Public endpoint — no auth required.
   * Returns 200 with { token, user }.
   */
  router.post('/accept-invitation', validateBody(AcceptInvitationSchema), async (c) => {
    const body = c.get('validatedBody' as never) as { token: string; password?: string; displayName?: string };
    const service = createAuthService(c);
    const result = await service.acceptInvitation(body);

    return c.json(result, 200);
  });

  /**
   * GET /invitations/:token — Get invitation details by token.
   * Public endpoint — no auth required.
   * Returns 200 with invitation details.
   */
  router.get('/invitations/:token', async (c) => {
    const token = c.req.param('token');
    const service = createAuthService(c);
    const result = await service.getInvitationDetails(token);

    return c.json(result, 200);
  });

  /**
   * GET /me — Get the currently authenticated user's profile.
   * Returns 200 with the user object.
   * Requires Authorization header (authMiddleware).
   */
  router.get('/me', authMiddleware, async (c) => {
    const userId = c.get('userId');
    const service = createAuthService(c);
    const user = await service.me(userId);

    return c.json(user, 200);
  });

  return router;
}

// ─── Factory Helper ──────────────────────────────────────────────────────────

function createAuthService(c: { env: { JWT_SECRET: string } }): AuthService {
  const userRepo = new UserRepository(getCollection<UserDocument>('users'));
  const tenantRepo = new TenantRepository(getCollection<TenantDocument>('tenants'));
  const tenantMemberRepo = new TenantMemberRepository(getCollection<TenantMemberDocument>('tenant_members'));

  return new AuthService(userRepo, tenantRepo, tenantMemberRepo, c.env.JWT_SECRET);
}
