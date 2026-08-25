import { Hono } from 'hono';
import type { AppEnv } from '../types/context.js';
import { validateBody } from '../middleware/validation.js';
import {
  CreateTenantSchema,
  UpdateTenantSchema,
  InviteMemberSchema,
  UpdateMemberRoleSchema,
} from '../schemas/tenant.js';

// ─── Tenant Routes ───────────────────────────────────────────────────────────

export function createTenantRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  // ─── Tenant CRUD ────────────────────────────────────────────────────────

  router.get('/', async (c) => {
    const userId = c.get('userId');
    const tenants = await c.get('svc').tenants.listTenantsWithRole(userId);

    return c.json({ data: tenants });
  });

  router.post('/', validateBody(CreateTenantSchema), async (c) => {
    const userId = c.get('userId');
    const body = c.req.valid('json');
    const tenant = await c.get('svc').tenants.createTenant(userId, body);

    return c.json({ data: tenant }, 201);
  });

  router.get('/:tenantId', async (c) => {
    const tenantId = c.req.param('tenantId');
    const tenant = await c.get('svc').tenants.getTenant(tenantId);

    return c.json({ data: tenant });
  });

  router.patch('/:tenantId', validateBody(UpdateTenantSchema), async (c) => {
    const userId = c.get('userId');
    const tenantId = c.req.param('tenantId');
    const body = c.req.valid('json');
    const tenant = await c.get('svc').tenants.updateTenant(userId, tenantId, body);

    return c.json({ data: tenant });
  });

  // ─── Tenant Lifecycle ───────────────────────────────────────────────────

  router.delete('/:tenantId', async (c) => {
    const userId = c.get('userId');
    const tenantId = c.req.param('tenantId');

    await c.get('svc').tenants.deleteTenant(userId, tenantId);

    return c.json({ data: { success: true } });
  });

  router.post('/:tenantId/archive', async (c) => {
    const userId = c.get('userId');
    const tenantId = c.req.param('tenantId');

    await c.get('svc').tenants.archiveTenant(userId, tenantId);

    return c.json({ data: { success: true } });
  });

  router.post('/:tenantId/restore', async (c) => {
    const userId = c.get('userId');
    const tenantId = c.req.param('tenantId');

    await c.get('svc').tenants.restoreTenant(userId, tenantId);

    return c.json({ data: { success: true } });
  });

  router.post('/:tenantId/cancel-deletion', async (c) => {
    const userId = c.get('userId');
    const tenantId = c.req.param('tenantId');

    await c.get('svc').tenants.cancelDeletion(userId, tenantId);

    return c.json({ data: { success: true } });
  });

  // ─── Member Management ─────────────────────────────────────────────────

  router.get('/:tenantId/members', async (c) => {
    const tenantId = c.req.param('tenantId');
    const members = await c.get('svc').tenantMembers.getTenantMembers(tenantId);

    return c.json({ data: members });
  });

  router.post('/:tenantId/members/invite', validateBody(InviteMemberSchema), async (c) => {
    const userId = c.get('userId');
    const tenantId = c.req.param('tenantId');
    const body = c.req.valid('json');
    const member = await c.get('svc').tenantMembers.inviteUser(userId, tenantId, body.email, body.role);

    return c.json({ data: member }, 201);
  });

  router.patch('/:tenantId/members/:memberUserId', validateBody(UpdateMemberRoleSchema), async (c) => {
    const userId = c.get('userId');
    const tenantId = c.req.param('tenantId');
    const memberUserId = c.req.param('memberUserId');
    const body = c.req.valid('json');
    const member = await c.get('svc').tenantMembers.updateMemberRole(userId, tenantId, memberUserId, body.role);

    return c.json({ data: member });
  });

  router.delete('/:tenantId/members/:memberUserId', async (c) => {
    const userId = c.get('userId');
    const tenantId = c.req.param('tenantId');
    const memberUserId = c.req.param('memberUserId');

    await c.get('svc').tenantMembers.removeMember(userId, tenantId, memberUserId);

    return c.json({ data: { success: true } });
  });

  router.post('/:tenantId/members/:memberUserId/restore', async (c) => {
    const userId = c.get('userId');
    const tenantId = c.req.param('tenantId');
    const memberUserId = c.req.param('memberUserId');

    await c.get('svc').tenantMembers.restoreMembership(userId, tenantId, memberUserId);

    return c.json({ data: { success: true } });
  });

  router.post('/:tenantId/members/:memberUserId/reinvite', async (c) => {
    const userId = c.get('userId');
    const tenantId = c.req.param('tenantId');
    const memberUserId = c.req.param('memberUserId');

    await c.get('svc').tenantMembers.reinviteUser(userId, tenantId, memberUserId);

    return c.json({ data: { success: true } });
  });

  // ─── User Deletion (admin only) ──────────────────────────────────────────

  router.delete('/users/:userId', async (c) => {
    const requesterId = c.get('userId');
    const userId = c.req.param('userId');

    await c.get('svc').tenants.deleteUser(requesterId, userId);

    return c.json({ data: { success: true } });
  });

  return router;
}
