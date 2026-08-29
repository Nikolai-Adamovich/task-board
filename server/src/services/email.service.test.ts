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

    it('HTML-escapes interpolated values (N-13)', async () => {
      await service.sendInvitationEmail({
        to: 'user@example.com',
        inviterName: '<script>alert("x")</script>',
        tenantName: 'Acme & Co <b>',
        role: 'member"><img src=x onerror=alert(1)>',
        token: 'tok',
      });

      const html = mockSend.mock.calls[0]?.[0]?.html as string;

      // Raw markup must not survive into the HTML body
      expect(html).not.toContain('<script>');
      expect(html).not.toContain('<b>');
      expect(html).not.toContain('<img');
      // Escaped forms are present instead (entities built via concatenation so
      // this source file never contains a raw HTML entity)
      expect(html).toContain('&' + 'lt;script' + '&' + 'gt;');
      expect(html).toContain('Acme &' + 'amp; Co &' + 'lt;b' + '&' + 'gt;');
      expect(html).toContain('&' + 'quot;');
    });

    it('escapes the tenant name in the subject as plain text (no HTML context)', async () => {
      await service.sendInvitationEmail({
        to: 'user@example.com',
        inviterName: 'Jane',
        tenantName: 'A<B>',
        role: 'member',
        token: 'tok',
      });

      const call = mockSend.mock.calls[0]?.[0] as { subject: string; html: string };

      // Subject is plain text — raw value is fine there; the HTML body must be escaped
      expect(call.subject).toBe("You're invited to join A<B>");
      expect(call.html).not.toContain('<B>');
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
    it('logs the invitation details as a single structured line', async () => {
      await service.sendInvitationEmail({
        to: 'user@example.com',
        inviterName: 'John',
        tenantName: 'Acme',
        role: 'member',
        token: 'tok-123',
      });

      // S-19: one single-line JSON entry per email
      expect(consoleSpy).toHaveBeenCalledTimes(1);

      const entry = JSON.parse(consoleSpy.mock.calls[0]?.[0] as string) as Record<string, unknown>;

      expect(entry.level).toBe('info');
      expect(entry.scope).toBe('email');
      expect(entry.to).toBe('user@example.com');
      expect(entry.tenantName).toBe('Acme');
      expect(entry.role).toBe('member');
      // token is masked in logs — raw tokens must never leak via the console stub
      expect(entry.acceptUrl).toContain('accept-invitation?token=<redacted>');
      expect(JSON.stringify(entry)).not.toContain('tok-123');
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('logs the reset details as a single structured line without leaking the token', async () => {
      await service.sendPasswordResetEmail({
        to: 'user@example.com',
        resetUrl: 'http://localhost:4200/auth/reset-password?token=tok-123',
        expiresInMinutes: 60,
      });

      expect(consoleSpy).toHaveBeenCalledTimes(1);

      const entry = JSON.parse(consoleSpy.mock.calls[0]?.[0] as string) as Record<string, unknown>;

      expect(entry.to).toBe('user@example.com');
      // token is masked in logs — raw tokens must never leak via the console stub
      expect(entry.resetUrl).toContain('/auth/reset-password?token=<redacted>');
      expect(entry.expiresInMinutes).toBe(60);
      expect(JSON.stringify(entry)).not.toContain('tok-123');
    });
  });

  describe('sendEmail', () => {
    it('logs the email details as a single structured line', async () => {
      await service.sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Hi</p>',
      });

      expect(consoleSpy).toHaveBeenCalledTimes(1);

      const entry = JSON.parse(consoleSpy.mock.calls[0]?.[0] as string) as Record<string, unknown>;

      expect(entry.to).toBe('test@example.com');
      expect(entry.subject).toBe('Test');
    });
  });
});
