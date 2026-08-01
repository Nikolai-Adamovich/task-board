import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { createSupportRoutes } from './support.js';

// ─── Mock EmailService ─────────────────────────────────────────────────────

const mockSendEmail = vi.fn().mockResolvedValue(undefined);

vi.mock('../services/email.service.js', () => ({
  EmailService: vi.fn().mockImplementation(() => ({
    sendEmail: mockSendEmail,
  })),
  ConsoleEmailService: vi.fn().mockImplementation(() => ({
    sendEmail: mockSendEmail,
  })),
}));

// ─── Test Suite ─────────────────────────────────────────────────────────────

describe('Support Routes', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
    app.route('/support', createSupportRoutes());
  });

  const validBody = {
    name: 'John Doe',
    email: 'john@example.com',
    message: 'I need help with my account',
    createdAt: Date.now() - 5000, // 5 seconds ago (past the 3s gate)
  };

  describe('POST /support', () => {
    it('should send an email and return success', async () => {
      const res = await app.request('/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validBody),
      });

      expect(res.status).toBe(200);

      const json = await res.json();

      expect(json).toEqual({ success: true });
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'support@taskboard.app',
          subject: expect.stringContaining('John Doe'),
        }),
      );
    });

    it('should return 422 for missing name', async () => {
      const res = await app.request('/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validBody, name: '' }),
      });

      expect(res.status).toBe(422);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('should return 422 for invalid email', async () => {
      const res = await app.request('/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validBody, email: 'not-an-email' }),
      });

      expect(res.status).toBe(422);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('should return 422 for message exceeding 2000 characters', async () => {
      const res = await app.request('/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validBody, message: 'a'.repeat(2001) }),
      });

      expect(res.status).toBe(422);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('should accept message at exactly 2000 characters', async () => {
      const res = await app.request('/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validBody, message: 'a'.repeat(2000) }),
      });

      expect(res.status).toBe(200);
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
    });

    it('should silently succeed when honeypot field is filled', async () => {
      const res = await app.request('/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validBody, website: 'http://spam.com' }),
      });

      expect(res.status).toBe(200);

      const json = await res.json();

      expect(json).toEqual({ success: true });
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('should silently succeed when submitted too fast', async () => {
      const res = await app.request('/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validBody, createdAt: Date.now() }), // just now
      });

      expect(res.status).toBe(200);

      const json = await res.json();

      expect(json).toEqual({ success: true });
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('should escape HTML in email body', async () => {
      const res = await app.request('/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...validBody,
          name: '<script>alert(1)</script>',
          message: 'Hello <b>world</b>',
        }),
      });

      expect(res.status).toBe(200);
      expect(mockSendEmail).toHaveBeenCalledTimes(1);

      const call = mockSendEmail.mock.calls[0][0];

      // Escaped entities should be present
      expect(call.html).toContain('<script>');
      expect(call.html).toContain('<b>');
      // Raw dangerous tags should NOT be present
      expect(call.subject).toContain('<script>');
    });
  });
});
