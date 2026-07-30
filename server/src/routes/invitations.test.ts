/**
 * Tests for invitation HTTP routes.
 *
 * Validates that the endpoints enforce auth, return proper HTTP status codes,
 * and correctly delegate to the TenantService.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { createInvitationRoutes } from './invitations.js';
import { errorHandler } from '../middleware/error-handler.js';
import type { AppEnv } from '../types/context.js';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../db/mongo.js', () => ({
  getCollection: vi.fn(() => ({})),
}));

vi.mock('../middleware/auth.js', () => ({
  authMiddleware: vi.fn().mockImplementation(async (_c: unknown, next: () => Promise<void>) => {
    await next();
  }),
}));

const mockGetMyInvitations = vi.fn().mockResolvedValue([
  {
    tenantId: 'tenant-1',
    tenantName: 'Acme',
    role: 'member',
    invitedAt: '2025-01-01T00:00:00.000Z',
    invitationToken: 'tok-1',
  },
]);
const mockDeclineInvitation = vi.fn().mockResolvedValue(undefined);

vi.mock('../services/tenant.service.js', () => ({
  TenantService: vi.fn().mockImplementation(() => ({
    getMyInvitations: mockGetMyInvitations,
    declineInvitation: mockDeclineInvitation,
  })),
}));

vi.mock('../repositories/tenant.repository.js', () => ({
  TenantRepository: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../repositories/tenant-member.repository.js', () => ({
  TenantMemberRepository: vi.fn().mockImplementation(() => ({})),
}));

const mockFindById = vi.fn().mockResolvedValue({
  id: 'user-1',
  email: 'test@example.com',
  displayName: 'Test User',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
});

vi.mock('../repositories/user.repository.js', () => ({
  UserRepository: vi.fn().mockImplementation(() => ({
    findById: mockFindById,
  })),
}));

vi.mock('../services/email.service.js', () => ({
  EmailService: vi.fn().mockImplementation(() => ({})),
  ConsoleEmailService: vi.fn().mockImplementation(() => ({})),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TEST_ENV = { JWT_SECRET: 'test-secret', MONGODB_URI: '', ALLOWED_ORIGINS: '*' };

function createTestApp() {
  const app = new Hono<AppEnv>();

  app.onError(errorHandler);

  // Simulate auth middleware setting userId
  app.use('/api/v1/invitations/*', async (c, next) => {
    c.set('userId', 'user-1');
    c.set('user', { id: 'user-1', email: 'test@example.com', displayName: 'Test User' });
    await next();
  });

  app.route('/api/v1/invitations', createInvitationRoutes());

  return app;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Invitation Routes', () => {
  beforeEach(() => {
    mockGetMyInvitations.mockClear();
    mockDeclineInvitation.mockClear();
    mockFindById.mockClear();
  });

  describe('GET /api/v1/invitations/my', () => {
    it('returns 200 with pending invitations', async () => {
      const app = createTestApp();
      const res = await app.request('/api/v1/invitations/my', { method: 'GET' }, TEST_ENV);

      expect(res.status).toBe(200);

      const body = (await res.json()) as { data: unknown[]; total: number };

      expect(body.data).toHaveLength(1);
      expect(body.total).toBe(1);
    });

    it('calls TenantService.getMyInvitations with user email', async () => {
      const app = createTestApp();

      await app.request('/api/v1/invitations/my', { method: 'GET' }, TEST_ENV);

      expect(mockFindById).toHaveBeenCalledWith('user-1');
      expect(mockGetMyInvitations).toHaveBeenCalledWith('test@example.com');
    });
  });

  describe('DELETE /api/v1/invitations/:invitationId', () => {
    it('returns 200 with success true on decline', async () => {
      const app = createTestApp();
      const res = await app.request('/api/v1/invitations/inv-123', { method: 'DELETE' }, TEST_ENV);

      expect(res.status).toBe(200);

      const body = (await res.json()) as { success: boolean };

      expect(body.success).toBe(true);
    });

    it('calls TenantService.declineInvitation with correct params', async () => {
      const app = createTestApp();

      await app.request('/api/v1/invitations/inv-123', { method: 'DELETE' }, TEST_ENV);

      expect(mockDeclineInvitation).toHaveBeenCalledWith('inv-123', 'user-1');
    });
  });
});
