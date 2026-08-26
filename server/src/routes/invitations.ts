import { Hono } from 'hono';
import type { Context } from 'hono';
import type { AppEnv } from '../types/context.js';
import { authMiddleware } from '../middleware/auth.js';

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
    const user = await c.get('svc').auth.me(userId);
    const invitations = await c.get('svc').tenantMembers.getMyInvitations(user.email);

    return c.json({ data: invitations });
  });

  /**
   * POST /invitations/:invitationId/accept — accept an invitation.
   */
  router.post('/:invitationId/accept', async (c) => {
    const invitationId = c.req.param('invitationId');

    await c.get('svc').tenantMembers.acceptInvitation(invitationId);

    return c.json({ data: { success: true } });
  });

  /**
   * POST /invitations/:invitationId/decline — decline an invitation (canonical).
   */
  const decline = async (c: Context) => {
    const userId = c.get('userId');
    const invitationId = c.req.param('invitationId');

    await c.get('svc').tenantMembers.declineInvitation(invitationId, userId);

    return c.json({ data: { success: true } });
  };

  router.post('/:invitationId/decline', decline);

  // V2-3: the UI's decline action fires `DELETE /invitations/:id`; expose the
  // same operation under that method so the flow works end-to-end.
  router.delete('/:invitationId', decline);

  return router;
}
