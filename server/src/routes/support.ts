import { Hono } from 'hono';
import type { AppEnv } from '../types/context.js';
import { SupportRequestSchema } from '../schemas/support.js';
import { validateBody } from '../middleware/validation.js';
import { EmailService, ConsoleEmailService } from '../services/email.service.js';
import { ValidationError } from '../middleware/error-handler.js';
import { z } from 'zod';

// ─── Rate Limiter ─────────────────────────────────────────────────────────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MIN_SUBMIT_DELAY_MS = 3000; // 3 seconds

function checkRateLimit(ip: string): void {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    throw new ValidationError('Too many requests. Please try again later.');
  }

  entry.count++;
}

// ─── HTML Escape ──────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"').replace(/'/g, '&#039;');
}

// ─── Support Routes ───────────────────────────────────────────────────────────

const SUPPORT_EMAIL = 'support@taskboard.app';
/** Extend the shared schema with anti-spam fields */
const SupportBodySchema = SupportRequestSchema.extend({
  website: z.string().optional(),
  createdAt: z.number().optional(),
});

export function createSupportRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.post('/', validateBody(SupportBodySchema), async (c) => {
    const body = c.get('validatedBody' as never) as z.infer<typeof SupportBodySchema>;

    // Honeypot check — silently succeed if bot filled the hidden field
    if (body.website) {
      return c.json({ success: true as const });
    }

    // Timing check — reject if submitted too fast
    if (body.createdAt) {
      const elapsed = Date.now() - body.createdAt;

      if (elapsed < MIN_SUBMIT_DELAY_MS) {
        return c.json({ success: true as const });
      }
    }

    // Rate limit by IP
    const ip = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? 'unknown';

    checkRateLimit(ip);

    // Send email
    const emailService = c.env?.RESEND_API_KEY
      ? new EmailService(c.env.RESEND_API_KEY, 'noreply@taskboard.app', c.env.FRONTEND_URL || '')
      : new ConsoleEmailService();
    const safeName = escapeHtml(body.name);
    const safeEmail = escapeHtml(body.email);
    const safeMessage = escapeHtml(body.message).replace(/\n/g, '<br>');

    await emailService.sendEmail({
      to: SUPPORT_EMAIL,
      subject: `Support request from ${safeName}`,
      html: `
        <h2>Support Request</h2>
        <p><strong>From:</strong> ${safeName} (${safeEmail})</p>
        <p><strong>Message:</strong></p>
        <p>${safeMessage}</p>
      `,
    });

    return c.json({ success: true as const });
  });

  return router;
}
