import { Hono } from 'hono';
import type { AppEnv } from '../types/context.js';
import { validateBody } from '../middleware/validation.js';
import { TenantService } from '../services/tenant.service.js';
import { TenantRepository } from '../repositories/tenant.repository.js';
import { TenantMemberRepository } from '../repositories/tenant-member.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import { getCollection } from '../db/mongo.js';
import type { TenantDocument } from '../repositories/tenant.repository.js';
import type { TenantMemberDocument } from '../repositories/tenant-member.repository.js';
import type { UserDocument } from '../repositories/user.repository.js';
import { CreateTenantSchema, UpdateTenantSchema } from '@task-board/shared';

// ─── Tenant Routes ───────────────────────────────────────────────────────────

/**
 * Creates and returns the tenant Hono app with all tenant-related routes.
 *
 * These routes are protected by authMiddleware and tenantContextMiddleware
 * (applied at the app level in index.ts). Specific routes that don't need
 * tenant context are registered before tenant-context middleware is applied.
 */
export function createTenantRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  /**
   * GET / — List all tenants for the authenticated user.
   * Does not require tenant context (cross-tenant query).
   */
  router.get('/', async (c) => {
    const userId = c.get('userId');
    const service = createTenantService();
    const tenants = await service.listTenantsForUser(userId);

    return c.json({
      data: tenants,
      total: tenants.length,
      page: 1,
      limit: tenants.length,
    });
  });

  /**
   * POST / — Create a new tenant.
   * The authenticated user becomes the owner.
   * Does not require tenant context.
   */
  router.post('/', validateBody(CreateTenantSchema), async (c) => {
    const userId = c.get('userId');
    const body = c.get('validatedBody' as never) as { name: string; slug: string };
    const service = createTenantService();
    const tenant = await service.createTenant(userId, body);

    return c.json(tenant, 201);
  });

  /**
   * GET /:tenantId — Get tenant details.
   */
  router.get('/:tenantId', async (c) => {
    const tenantId = c.req.param('tenantId');
    const service = createTenantService();
    const tenant = await service.getTenant(tenantId);

    return c.json(tenant);
  });

  /**
   * PATCH /:tenantId — Update tenant. Owner/admin only.
   */
  router.patch('/:tenantId', validateBody(UpdateTenantSchema), async (c) => {
    const userId = c.get('userId');
    const tenantId = c.req.param('tenantId');
    const body = c.get('validatedBody' as never) as { name?: string; slug?: string };
    const service = createTenantService();
    const tenant = await service.updateTenant(userId, tenantId, body);

    return c.json(tenant);
  });

  /**
   * DELETE /:tenantId — Delete tenant. Owner only.
   */
  router.delete('/:tenantId', async (c) => {
    const userId = c.get('userId');
    const tenantId = c.req.param('tenantId');
    const service = createTenantService();

    await service.deleteTenant(userId, tenantId);

    return c.json({ success: true as const });
  });

  // ─── Member Management ─────────────────────────────────────────────────────

  /**
   * POST /:tenantId/members — Invite a member to the tenant.
   * Owner/admin only. Body: { email, role }.
   */
  router.post('/:tenantId/members', async (c) => {
    const userId = c.get('userId');
    const tenantId = c.req.param('tenantId');
    const body = await c.req.json<{ email: string; role: string }>();
    const service = createTenantService();
    const member = await service.inviteMember(userId, tenantId, body.email, body.role);

    return c.json(member, 201);
  });

  /**
   * PATCH /:tenantId/members/:userId — Update a member's role.
   * Owner/admin only.
   */
  router.patch('/:tenantId/members/:memberUserId', async (c) => {
    const userId = c.get('userId');
    const tenantId = c.req.param('tenantId');
    const memberUserId = c.req.param('memberUserId');
    const body = await c.req.json<{ role: string }>();
    const service = createTenantService();
    const member = await service.updateMemberRole(userId, tenantId, memberUserId, body.role);

    return c.json(member);
  });

  /**
   * DELETE /:tenantId/members/:userId — Remove a member from the tenant.
   * Owner/admin only. Cannot remove the owner.
   */
  router.delete('/:tenantId/members/:memberUserId', async (c) => {
    const userId = c.get('userId');
    const tenantId = c.req.param('tenantId');
    const memberUserId = c.req.param('memberUserId');
    const service = createTenantService();

    await service.removeMember(userId, tenantId, memberUserId);

    return c.json({ success: true as const });
  });

  return router;
}

// ─── Factory Helper ──────────────────────────────────────────────────────────

function createTenantService(): TenantService {
  const tenantRepo = new TenantRepository(getCollection<TenantDocument>('tenants'));
  const tenantMemberRepo = new TenantMemberRepository(getCollection<TenantMemberDocument>('tenant_members'));
  const userRepo = new UserRepository(getCollection<UserDocument>('users'));

  return new TenantService(tenantRepo, tenantMemberRepo, userRepo);
}
