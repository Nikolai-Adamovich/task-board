import { Hono } from 'hono';
import type { AppEnv } from '../types/context.js';
import { authMiddleware } from '../middleware/auth.js';
import { TenantService } from '../services/tenant.service.js';
import { TenantRepository } from '../repositories/tenant.repository.js';
import { TenantMemberRepository } from '../repositories/tenant-member.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import { EmailService, ConsoleEmailService } from '../services/email.service.js';
import { getCollection } from '../db/mongo.js';
import { NotFoundError } from '../errors/app-error.js';
import type { TenantDocument } from '../repositories/tenant.repository.js';
import type { TenantMemberDocument } from '../repositories/tenant-member.repository.js';
import type { UserDocument } from '../repositories/user.repository.js';

// ─── Invitation Routes ──────────────────────────────────────────────────────

/**
 * Creates and returns the invitation Hono app with cross-tenant
 * invitation endpoints for the authenticated user.
 */
export function createInvitationRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  // All routes require auth
  router.use('*', authMiddleware);

  /**
   * GET /invitations/my — pending invitations for the authenticated user.
   */
  router.get('/my', async (c) => {
    const userId = c.get('userId');
    const userRepo = new UserRepository(getCollection<UserDocument>('users'));
    const user = await userRepo.findById(userId);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const service = createTenantService(c);
    const invitations = await service.getMyInvitations(user.email);

    return c.json({ data: invitations });
  });

  /**
   * POST /invitations/:invitationId/accept — accept an invitation.
   */
  router.post('/:invitationId/accept', async (c) => {
    const invitationId = c.req.param('invitationId');
    const service = createTenantService();

    await service.acceptInvitation(invitationId);

    return c.json({ data: { success: true } });
  });

  /**
   * POST /invitations/:invitationId/decline — decline an invitation.
   */
  router.post('/:invitationId/decline', async (c) => {
    const userId = c.get('userId');
    const invitationId = c.req.param('invitationId');
    const service = createTenantService();

    await service.declineInvitation(invitationId, userId);

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
