import { Hono } from 'hono';
import type { AppEnv } from '../types/context.js';
import { validateBody } from '../middleware/validation.js';
import { TenantService } from '../services/tenant.service.js';
import { TenantRepository } from '../repositories/tenant.repository.js';
import { TenantMemberRepository } from '../repositories/tenant-member.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import { EmailService, ConsoleEmailService } from '../services/email.service.js';
import { getCollection } from '../db/mongo.js';
import type { TenantDocument } from '../repositories/tenant.repository.js';
import type { TenantMemberDocument } from '../repositories/tenant-member.repository.js';
import type { UserDocument } from '../repositories/user.repository.js';
import {
  CreateTenantSchema,
  UpdateTenantSchema,
  InviteMemberSchema,
  UpdateMemberRoleSchema,
} from '../schemas/tenant.js';
import type { CreateTenant } from '@task-board/shared';

// ─── Tenant Routes ───────────────────────────────────────────────────────────

export function createTenantRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  // ─── Tenant CRUD ────────────────────────────────────────────────────────

  router.get('/', async (c) => {
    const userId = c.get('userId');
    const service = createTenantService(c);
    const tenants = await service.listTenantsWithRole(userId);

    return c.json({ data: tenants });
  });

  router.post('/', validateBody(CreateTenantSchema), async (c) => {
    const userId = c.get('userId');
    const body = c.get('validatedBody' as never) as CreateTenant;
    const service = createTenantService();
    const tenant = await service.createTenant(userId, body);

    return c.json({ data: tenant }, 201);
  });

  router.get('/:tenantId', async (c) => {
    const tenantId = c.req.param('tenantId');
    const service = createTenantService();
    const tenant = await service.getTenant(tenantId);

    return c.json({ data: tenant });
  });

  router.patch('/:tenantId', validateBody(UpdateTenantSchema), async (c) => {
    const userId = c.get('userId');
    const tenantId = c.req.param('tenantId');
    const body = c.get('validatedBody' as never) as { name?: string; description?: string };
    const service = createTenantService();
    const tenant = await service.updateTenant(userId, tenantId, body);

    return c.json({ data: tenant });
  });

  // ─── Tenant Lifecycle ───────────────────────────────────────────────────

  router.delete('/:tenantId', async (c) => {
    const userId = c.get('userId');
    const tenantId = c.req.param('tenantId');
    const service = createTenantService();

    await service.deleteTenant(userId, tenantId);

    return c.json({ data: { success: true } });
  });

  router.post('/:tenantId/archive', async (c) => {
    const userId = c.get('userId');
    const tenantId = c.req.param('tenantId');
    const service = createTenantService();

    await service.archiveTenant(userId, tenantId);

    return c.json({ data: { success: true } });
  });

  router.post('/:tenantId/restore', async (c) => {
    const userId = c.get('userId');
    const tenantId = c.req.param('tenantId');
    const service = createTenantService();

    await service.restoreTenant(userId, tenantId);

    return c.json({ data: { success: true } });
  });

  router.post('/:tenantId/cancel-deletion', async (c) => {
    const userId = c.get('userId');
    const tenantId = c.req.param('tenantId');
    const service = createTenantService();

    await service.cancelDeletion(userId, tenantId);

    return c.json({ data: { success: true } });
  });

  // ─── Member Management ─────────────────────────────────────────────────

  router.get('/:tenantId/members', async (c) => {
    const tenantId = c.req.param('tenantId');
    const service = createTenantService();
    const members = await service.getTenantMembers(tenantId);

    return c.json({ data: members });
  });

  router.post('/:tenantId/members/invite', validateBody(InviteMemberSchema), async (c) => {
    const userId = c.get('userId');
    const tenantId = c.req.param('tenantId');
    const body = c.get('validatedBody' as never) as { email: string; role: string };
    const service = createTenantService(c);
    const member = await service.inviteUser(userId, tenantId, body.email, body.role);

    return c.json({ data: member }, 201);
  });

  router.patch('/:tenantId/members/:memberUserId', validateBody(UpdateMemberRoleSchema), async (c) => {
    const userId = c.get('userId');
    const tenantId = c.req.param('tenantId');
    const memberUserId = c.req.param('memberUserId');
    const body = c.get('validatedBody' as never) as { role: string };
    const service = createTenantService();
    const member = await service.updateMemberRole(userId, tenantId, memberUserId, body.role);

    return c.json({ data: member });
  });

  router.delete('/:tenantId/members/:memberUserId', async (c) => {
    const userId = c.get('userId');
    const tenantId = c.req.param('tenantId');
    const memberUserId = c.req.param('memberUserId');
    const service = createTenantService();

    await service.removeMember(userId, tenantId, memberUserId);

    return c.json({ data: { success: true } });
  });

  router.post('/:tenantId/members/:memberUserId/restore', async (c) => {
    const userId = c.get('userId');
    const tenantId = c.req.param('tenantId');
    const memberUserId = c.req.param('memberUserId');
    const service = createTenantService();

    await service.restoreMembership(userId, tenantId, memberUserId);

    return c.json({ data: { success: true } });
  });

  router.post('/:tenantId/members/:memberUserId/reinvite', async (c) => {
    const userId = c.get('userId');
    const tenantId = c.req.param('tenantId');
    const memberUserId = c.req.param('memberUserId');
    const service = createTenantService(c);

    await service.reinviteUser(userId, tenantId, memberUserId);

    return c.json({ data: { success: true } });
  });

  // ─── User Deletion (admin only) ──────────────────────────────────────────

  router.delete('/users/:userId', async (c) => {
    const requesterId = c.get('userId');
    const userId = c.req.param('userId');
    const service = createTenantService();

    await service.deleteUser(requesterId, userId);

    return c.json({ data: { success: true } });
  });

  return router;
}

// ─── Factory Helper ──────────────────────────────────────────────────────────

function createTenantService(c?: { env: { RESEND_API_KEY?: string; FRONTEND_URL?: string } }): TenantService {
  const tenantRepo = new TenantRepository(getCollection<TenantDocument>('tenants'));
  const tenantMemberRepo = new TenantMemberRepository(getCollection<TenantMemberDocument>('tenant_members'));
  const userRepo = new UserRepository(getCollection<UserDocument>('users'));
  const emailService = c?.env?.RESEND_API_KEY
    ? new EmailService(c.env.RESEND_API_KEY, 'noreply@taskboard.app', c.env.FRONTEND_URL || '')
    : new ConsoleEmailService();

  return new TenantService(tenantRepo, tenantMemberRepo, userRepo, emailService);
}
