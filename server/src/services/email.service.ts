import { Resend } from 'resend';
import { createLogger } from '../utils/logger.js';
import { escapeHtml } from '../utils/escape-html.js';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export class EmailService {
  private readonly resend: Resend;
  private readonly fromEmail: string;
  private readonly frontendUrl: string;

  constructor(apiKey: string, fromEmail: string, frontendUrl: string) {
    this.resend = new Resend(apiKey);
    this.fromEmail = fromEmail;
    this.frontendUrl = frontendUrl;
  }

  async sendPasswordResetEmail(params: { to: string; resetUrl: string; expiresInMinutes: number }): Promise<void> {
    const html = `
      <h2>Password reset request</h2>
      <p>We received a request to reset your password.</p>
      <p><a href="${escapeHtml(params.resetUrl)}">Reset your password</a></p>
      <p>This link is valid for ${escapeHtml(String(params.expiresInMinutes))} minutes and can only be used once. If you didn't request a password reset, you can safely ignore this email.</p>
    `;

    await this.resend.emails.send({
      from: this.fromEmail,
      to: params.to,
      subject: 'Reset your password',
      html,
    });
  }

  async sendInvitationEmail(params: {
    to: string;
    inviterName: string;
    tenantName: string;
    role: string;
    token: string;
  }): Promise<void> {
    const acceptUrl = `${this.frontendUrl}/auth/accept-invitation?token=${params.token}`;
    const html = `
      <h2>You've been invited to ${escapeHtml(params.tenantName)}</h2>
      <p>${escapeHtml(params.inviterName)} has invited you to join <strong>${escapeHtml(params.tenantName)}</strong> as a <strong>${escapeHtml(params.role)}</strong>.</p>
      <p><a href="${escapeHtml(acceptUrl)}">Accept Invitation</a></p>
      <p>If you don't have an account yet, you'll be able to create one when accepting the invitation.</p>
    `;

    await this.resend.emails.send({
      from: this.fromEmail,
      to: params.to,
      subject: `You're invited to join ${params.tenantName}`,
      html,
    });
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    await this.resend.emails.send({
      from: this.fromEmail,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
  }
}

/** Mask the `token` query parameter of a URL before logging it — if the
 * console mailer ever runs in production (missing RESEND_API_KEY), raw
 * invitation/reset tokens must not leak into logs. */
function maskTokenInUrl(url: string): string {
  return url.replace(/(token=)[^&]+/, '$1<redacted>');
}

const log = createLogger({ scope: 'email' });

export class ConsoleEmailService implements Pick<
  EmailService,
  'sendEmail' | 'sendInvitationEmail' | 'sendPasswordResetEmail'
> {
  async sendPasswordResetEmail(params: { to: string; resetUrl: string; expiresInMinutes: number }): Promise<void> {
    log.info('Password reset email (dev stub — not delivered)', {
      to: params.to,
      resetUrl: maskTokenInUrl(params.resetUrl),
      expiresInMinutes: params.expiresInMinutes,
    });
  }

  async sendInvitationEmail(params: {
    to: string;
    inviterName: string;
    tenantName: string;
    role: string;
    token: string;
  }): Promise<void> {
    const acceptUrl = `${process.env.FRONTEND_URL || 'http://localhost:4200'}/auth/accept-invitation?token=${params.token}`;

    log.info('Invitation email (dev stub — not delivered)', {
      to: params.to,
      tenantName: params.tenantName,
      role: params.role,
      acceptUrl: maskTokenInUrl(acceptUrl),
    });
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    log.info('Email (dev stub — not delivered)', { to: options.to, subject: options.subject });
  }
}
