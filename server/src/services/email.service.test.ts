import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EmailService, ConsoleEmailService } from './email.service.js';

// ─── Mock Resend ─────────────────────────────────────────────────────────────

const mockSend = vi.fn().mockResolvedValue({ id: 'email-123' });

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: mockSend,
    },
  })),
}));

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(() => {
    mockSend.mockClear();
    service = new EmailService('re_test_key', 'noreply@taskboard.app', 'https://app.example.com');
  });

  describe('sendInvitationEmail', () => {
    it('sends an email with the correct params', async () => {
      await service.sendInvitationEmail({
        to: 'user@example.com',
        inviterName: 'John',
        tenantName: 'Acme',
        role: 'member',
        token: 'inv-token-123',
      });

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith({
        from: 'noreply@taskboard.app',
        to: 'user@example.com',
        subject: "You're invited to join Acme",
        html: expect.stringContaining('inv-token-123'),
      });
    });

    it('includes the accept URL in the HTML body', async () => {
      await service.sendInvitationEmail({
        to: 'user@example.com',
        inviterName: 'John',
        tenantName: 'Acme',
        role: 'admin',
        token: 'abc',
      });

      const html = mockSend.mock.calls[0]?.[0]?.html as string;

      expect(html).toContain('https://app.example.com/auth/accept-invitation?token=abc');
    });

    it('includes inviter and tenant info in the HTML body', async () => {
      await service.sendInvitationEmail({
        to: 'user@example.com',
        inviterName: 'Jane',
        tenantName: 'My Workspace',
        role: 'member',
        token: 'tok',
      });

      const html = mockSend.mock.calls[0]?.[0]?.html as string;

      expect(html).toContain('Jane');
      expect(html).toContain('My Workspace');
      expect(html).toContain('member');
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('sends an email with the reset URL and expiry', async () => {
      await service.sendPasswordResetEmail({
        to: 'user@example.com',
        resetUrl: 'https://app.example.com/auth/reset-password?token=abc123',
        expiresInMinutes: 60,
      });

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith({
        from: 'noreply@taskboard.app',
        to: 'user@example.com',
        subject: 'Reset your password',
        html: expect.stringContaining('https://app.example.com/auth/reset-password?token=abc123'),
      });

      const html = mockSend.mock.calls[0]?.[0]?.html as string;

      expect(html).toContain('60 minutes');
    });
  });

  describe('sendEmail', () => {
    it('sends a generic email', async () => {
      await service.sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Hello</p>',
      });

      expect(mockSend).toHaveBeenCalledWith({
        from: 'noreply@taskboard.app',
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Hello</p>',
      });
    });
  });
});

describe('ConsoleEmailService', () => {
  let service: ConsoleEmailService;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    service = new ConsoleEmailService();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('sendInvitationEmail', () => {
    it('logs the invitation details', async () => {
      await service.sendInvitationEmail({
        to: 'user@example.com',
        inviterName: 'John',
        tenantName: 'Acme',
        role: 'member',
        token: 'tok-123',
      });

      // ConsoleEmailService logs 4 times: to, tenant, role, accept URL
      expect(consoleSpy).toHaveBeenCalledTimes(4);

      const invitationLog = consoleSpy.mock.calls[0]?.[0] as string;
      const tenantLog = consoleSpy.mock.calls[1]?.[0] as string;
      const roleLog = consoleSpy.mock.calls[2]?.[0] as string;
      const urlLog = consoleSpy.mock.calls[3]?.[0] as string;

      expect(invitationLog).toContain('user@example.com');
      expect(tenantLog).toContain('Acme');
      expect(roleLog).toContain('member');
      expect(urlLog).toContain('accept-invitation?token=tok-123');
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('logs the reset details without leaking the token separately', async () => {
      await service.sendPasswordResetEmail({
        to: 'user@example.com',
        resetUrl: 'http://localhost:4200/auth/reset-password?token=tok-123',
        expiresInMinutes: 60,
      });

      expect(consoleSpy).toHaveBeenCalledTimes(3);

      const toLog = consoleSpy.mock.calls[0]?.[0] as string;
      const urlLog = consoleSpy.mock.calls[1]?.[0] as string;
      const expiryLog = consoleSpy.mock.calls[2]?.[0] as string;

      expect(toLog).toContain('user@example.com');
      expect(urlLog).toContain('/auth/reset-password?token=tok-123');
      expect(expiryLog).toContain('60 minutes');
    });
  });

  describe('sendEmail', () => {
    it('logs the email details', async () => {
      await service.sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Hi</p>',
      });

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy.mock.calls[0]?.[0]).toContain('test@example.com');
      expect(consoleSpy.mock.calls[0]?.[0]).toContain('Test');
    });
  });
});
