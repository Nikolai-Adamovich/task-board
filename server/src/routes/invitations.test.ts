/**
 * Tests for invitation HTTP routes.
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
    id: 'member-1',
    tenantId: 'tenant-1',
    userId: 'user-1',
    role: 'MEMBER',
    status: 'ACTIVE',
    invitation: { status: 'PENDING', tokenHash: 'hash', invitedBy: 'owner', invitedOn: '2025-01-01T00:00:00.000Z' },
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
]);
const mockAcceptInvitation = vi.fn().mockResolvedValue(undefined);
const mockDeclineInvitation = vi.fn().mockResolvedValue(undefined);

vi.mock('../services/tenant.service.js', () => ({
  TenantService: vi.fn().mockImplementation(() => ({
    getMyInvitations: mockGetMyInvitations,
    acceptInvitation: mockAcceptInvitation,
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
  avatarUrl: null,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  deletedAt: null,
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

  app.use('/api/invitations/*', async (c, next) => {
    c.set('userId', 'user-1');
    c.set('user', {
      id: 'user-1',
      email: 'test@example.com',
      displayName: 'Test User',
      avatarUrl: null,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      deletedAt: null,
    });
    await next();
  });

  app.route('/api/invitations', createInvitationRoutes());

  return app;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Invitation Routes', () => {
  beforeEach(() => {
    mockGetMyInvitations.mockClear();
    mockAcceptInvitation.mockClear();
    mockDeclineInvitation.mockClear();
    mockFindById.mockClear();
  });

  describe('GET /api/invitations/my', () => {
    it('returns 200 with { data } envelope', async () => {
      const app = createTestApp();
      const res = await app.request('/api/invitations/my', { method: 'GET' }, TEST_ENV);

      expect(res.status).toBe(200);

      const body = (await res.json()) as { data: unknown[] };

      expect(body.data).toHaveLength(1);
    });
  });

  describe('POST /api/invitations/:invitationId/accept', () => {
    it('returns 200 with success', async () => {
      const app = createTestApp();
      const res = await app.request('/api/invitations/inv-123/accept', { method: 'POST' }, TEST_ENV);

      expect(res.status).toBe(200);

      const body = (await res.json()) as { data: { success: boolean } };

      expect(body.data.success).toBe(true);
    });

    it('calls TenantService.acceptInvitation', async () => {
      const app = createTestApp();

      await app.request('/api/invitations/inv-123/accept', { method: 'POST' }, TEST_ENV);

      expect(mockAcceptInvitation).toHaveBeenCalledWith('inv-123');
    });
  });

  describe('POST /api/invitations/:invitationId/decline', () => {
    it('returns 200 with success', async () => {
      const app = createTestApp();
      const res = await app.request('/api/invitations/inv-123/decline', { method: 'POST' }, TEST_ENV);

      expect(res.status).toBe(200);

      const body = (await res.json()) as { data: { success: boolean } };

      expect(body.data.success).toBe(true);
    });

    it('calls TenantService.declineInvitation', async () => {
      const app = createTestApp();

      await app.request('/api/invitations/inv-123/decline', { method: 'POST' }, TEST_ENV);

      expect(mockDeclineInvitation).toHaveBeenCalledWith('inv-123', 'user-1');
    });
  });
});
