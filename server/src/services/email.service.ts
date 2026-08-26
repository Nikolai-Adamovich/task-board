import { Resend } from 'resend';

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
      <p><a href="${params.resetUrl}">Reset your password</a></p>
      <p>This link is valid for ${params.expiresInMinutes} minutes and can only be used once. If you didn't request a password reset, you can safely ignore this email.</p>
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
      <h2>You've been invited to ${params.tenantName}</h2>
      <p>${params.inviterName} has invited you to join <strong>${params.tenantName}</strong> as a <strong>${params.role}</strong>.</p>
      <p><a href="${acceptUrl}">Accept Invitation</a></p>
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

/* eslint-disable no-console -- ConsoleEmailService is a dev/test stub that intentionally logs instead of sending emails */
export class ConsoleEmailService implements Pick<
  EmailService,
  'sendEmail' | 'sendInvitationEmail' | 'sendPasswordResetEmail'
> {
  async sendPasswordResetEmail(params: { to: string; resetUrl: string; expiresInMinutes: number }): Promise<void> {
    console.log(`[EMAIL] Password reset to ${params.to}`);
    console.log(`  Reset URL: ${params.resetUrl}`);
    console.log(`  Expires in: ${params.expiresInMinutes} minutes`);
  }

  async sendInvitationEmail(params: {
    to: string;
    inviterName: string;
    tenantName: string;
    role: string;
    token: string;
  }): Promise<void> {
    const acceptUrl = `${process.env.FRONTEND_URL || 'http://localhost:4200'}/auth/accept-invitation?token=${params.token}`;

    console.log(`[EMAIL] Invitation to ${params.to}`);
    console.log(`  Tenant: ${params.tenantName}`);
    console.log(`  Role: ${params.role}`);
    console.log(`  Accept URL: ${acceptUrl}`);
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    console.log(`[EMAIL] To: ${options.to}, Subject: ${options.subject}`);
  }
}
/* eslint-enable no-console */
