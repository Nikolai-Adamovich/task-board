import { randomBytes } from 'node:crypto';
import { sign } from 'hono/jwt';
import { MemberStatus, InvitationStatus, JWT_TTL_SECONDS, PASSWORD_RESET_TTL_MINUTES } from '@task-board/shared';
import type {
  User,
  AuthResponse,
  RegisterRequest,
  LoginRequest,
  InvitationDetails,
  TenantRole,
  ForgotPasswordResponse,
} from '@task-board/shared';
import { AppError, BadRequestError, ConflictError, NotFoundError, ValidationError } from '../errors/app-error.js';
import { UserRepository } from '../repositories/user.repository.js';
import { TenantRepository } from '../repositories/tenant.repository.js';
import { TenantMemberRepository } from '../repositories/tenant-member.repository.js';

// ─── JWT Utilities (hono/jwt — Workers compatible) ───────────────────────────

/** Claims carried by the access token */
export interface JwtPayload {
  sub: string;
  email: string;
  displayName: string;
  tenantId: string | null;
  tenantRole: TenantRole | null;
  iat?: number;
  exp?: number;
  [key: string]: unknown;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const BCRYPT_SALT_ROUNDS = 10;
/** Forgot-password rate limit: max requests per email+IP within the window */
const FORGOT_PASSWORD_MAX_REQUESTS = 5;
const FORGOT_PASSWORD_WINDOW_MS = 15 * 60 * 1000;
/** Login rate limit: max attempts per email+IP within the window (brute-force mitigation) */
const LOGIN_MAX_REQUESTS = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
/** Registration rate limit: max accounts per IP within the window (mass-creation mitigation) */
const REGISTER_MAX_REQUESTS = 20;
const REGISTER_WINDOW_MS = 60 * 60 * 1000;

/**
 * Minimal mailer contract needed by AuthService for password-reset emails.
 * Satisfied by both EmailService (Resend) and ConsoleEmailService.
 */
export interface PasswordResetMailer {
  sendPasswordResetEmail(params: { to: string; resetUrl: string; expiresInMinutes: number }): Promise<void>;
}

/**
 * Best-effort in-memory sliding-window rate limiter factory.
 *
 * Intentionally module-level: limiters must survive across requests to be
 * effective. On Cloudflare Workers they are per-isolate and reset on eviction
 * — acceptable for MVP abuse mitigation (DEC-023 / security notes §21).
 */
function createRateLimiter(maxRequests: number, windowMs: number): (key: string) => boolean {
  const attempts = new Map<string, number[]>();

  return (key: string): boolean => {
    const now = Date.now();
    const timestamps = (attempts.get(key) ?? []).filter((ts) => now - ts < windowMs);

    if (timestamps.length >= maxRequests) {
      attempts.set(key, timestamps);
      return true;
    }

    timestamps.push(now);
    attempts.set(key, timestamps);

    // Opportunistic cleanup of stale keys to bound memory growth
    if (attempts.size > 1000) {
      for (const [k, ts] of attempts) {
        if (ts.every((t) => now - t >= windowMs)) {
          attempts.delete(k);
        }
      }
    }

    return false;
  };
}

const isForgotPasswordRateLimited = createRateLimiter(FORGOT_PASSWORD_MAX_REQUESTS, FORGOT_PASSWORD_WINDOW_MS);
const isLoginRateLimited = createRateLimiter(LOGIN_MAX_REQUESTS, LOGIN_WINDOW_MS);
const isRegisterRateLimited = createRateLimiter(REGISTER_MAX_REQUESTS, REGISTER_WINDOW_MS);

/** Create a deterministic SHA-256 hash of a token for storage/lookup (Web Crypto — Workers compatible) */
async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

// ─── Auth Service ────────────────────────────────────────────────────────────

export class AuthService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly tenantRepo: TenantRepository,
    private readonly tenantMemberRepo: TenantMemberRepository,
    private readonly jwtSecret: string,
    private readonly mailer?: PasswordResetMailer | null,
    private readonly frontendUrl = 'http://localhost:4200',
  ) {}

  /**
   * Find an active (non-deleted) user by id.
   * Used by authMiddleware to reject tokens of soft-deleted users.
   */
  findActiveUser(id: string): Promise<User | null> {
    return this.userRepo.findById(id);
  }

  /**
   * Register a new user.
   * Creates the user and activates any pending invitations for the email.
   * Rate-limited per client IP (mass account creation mitigation).
   */
  async register(input: RegisterRequest, clientIp?: string): Promise<AuthResponse> {
    if (isRegisterRateLimited(clientIp ?? 'unknown')) {
      throw new AppError(429, 'RATE_LIMITED', 'Too many registration attempts. Try again later.');
    }

    const normalizedEmail = input.email.toLowerCase().trim();
    const existingUser = await this.userRepo.findByEmail(normalizedEmail);

    if (existingUser) {
      throw new ConflictError('A user with this email already exists');
    }

    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);
    const user = await this.userRepo.create({
      email: normalizedEmail,
      displayName: input.displayName,
      passwordHash,
    });
    // Activate pending invitations for this email
    const pendingInvitations = await this.tenantMemberRepo.findPendingByEmail(normalizedEmail);
    let firstTenantId: string | null = null;
    let firstTenantRole: TenantRole | null = null;

    for (const member of pendingInvitations) {
      await this.tenantMemberRepo.update(member.id, {
        status: MemberStatus.ACTIVE,
        invitation: null,
      });
      if (!firstTenantId) {
        firstTenantId = member.tenantId;
        firstTenantRole = member.role as TenantRole;
      }
    }

    const token = await this.generateToken(user, firstTenantId, firstTenantRole);

    return { token, user };
  }

  /**
   * Log in with email and password.
   * Rate-limited per email+IP (brute-force mitigation).
   */
  async login(input: LoginRequest, clientIp?: string): Promise<AuthResponse> {
    const normalizedEmail = input.email.toLowerCase().trim();

    if (isLoginRateLimited(`${normalizedEmail}:${clientIp ?? 'unknown'}`)) {
      throw new AppError(429, 'RATE_LIMITED', 'Too many login attempts. Try again later.');
    }

    const userDoc = await this.userRepo.findByEmail(normalizedEmail);

    // V1-8: wrong credentials must return a distinct INVALID_CREDENTIALS code so
    // the UI can show a neutral "Invalid email or password" message instead of
    // mapping every 401 to session-expired copy.
    if (!userDoc) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const bcrypt = await import('bcryptjs');
    const passwordValid = await bcrypt.compare(input.password, userDoc.passwordHash);

    if (!passwordValid) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const memberships = await this.tenantMemberRepo.findByUser(userDoc.id);
    const activeMembership = memberships.find((m) => m.status === MemberStatus.ACTIVE);
    const user: User = {
      id: userDoc.id,
      email: userDoc.email,
      displayName: userDoc.displayName,
      avatarUrl: userDoc.avatarUrl,
      createdAt: userDoc.createdAt.toISOString(),
      updatedAt: userDoc.updatedAt.toISOString(),
      deletedAt: userDoc.deletedAt ? userDoc.deletedAt.toISOString() : null,
    };
    const token = await this.generateToken(user, activeMembership?.tenantId ?? null, activeMembership?.role ?? null);

    return { token, user };
  }

  /**
   * Get the current user's profile.
   */
  async me(userId: string): Promise<User> {
    const user = await this.userRepo.findById(userId);

    if (!user) {
      throw new NotFoundError('User not found');
    }
    return user;
  }

  /**
   * Accept an invitation to join a tenant.
   * Token is matched via SHA-256 hash.
   */
  async acceptInvitation(input: { token: string; password?: string; displayName?: string }): Promise<AuthResponse> {
    const hash = await hashToken(input.token);
    const invitation = await this.tenantMemberRepo.findByInvitationToken(hash);

    if (!invitation || !invitation.invitation || invitation.invitation.status !== InvitationStatus.PENDING) {
      throw new NotFoundError('Invalid or expired invitation');
    }

    // V5-2: inspect the document (not the domain projection) to distinguish a
    // real account from an invitation placeholder (empty passwordHash).
    const doc = await this.userRepo.findDocumentById(invitation.userId);

    if (!doc) {
      throw new NotFoundError('Invitation user not found');
    }

    let user: User = {
      id: doc.id,
      email: doc.email,
      displayName: doc.displayName,
      avatarUrl: doc.avatarUrl,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
      deletedAt: doc.deletedAt ? doc.deletedAt.toISOString() : null,
    };

    if (doc.passwordHash === '') {
      // Placeholder account — completing the invitation REQUIRES password setup.
      if (!input.password || !input.displayName) {
        throw new ValidationError('Password and display name are required to activate this invitation');
      }

      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.hash(input.password, 10);

      await this.userRepo.setPasswordAndDisplayName(doc.id, passwordHash, input.displayName);
      user = { ...user, displayName: input.displayName };
    }

    // Activate the membership
    await this.tenantMemberRepo.update(invitation.id, {
      status: MemberStatus.ACTIVE,
      invitation: null,
    });

    const token = await this.generateToken(user, invitation.tenantId, invitation.role as TenantRole);

    return { token, user };
  }

  /**
   * Get invitation details by token.
   */
  async getInvitationDetails(token: string): Promise<InvitationDetails> {
    const hash = await hashToken(token);
    const invitation = await this.tenantMemberRepo.findByInvitationToken(hash);

    if (!invitation || !invitation.invitation) {
      throw new NotFoundError('Invitation not found');
    }

    const tenant = await this.tenantRepo.findById(invitation.tenantId);

    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    // V5-2: a placeholder account (created at invite time for an email with no
    // account, passwordHash '') is NOT a registered user — the invitee must go
    // through password setup, not the "you already have an account" path.
    const doc = await this.userRepo.findDocumentById(invitation.userId);
    const isRegistered = doc !== null && doc.passwordHash !== '';

    return {
      email: doc?.email ?? '',
      tenantName: tenant.name,
      role: invitation.role as InvitationDetails['role'],
      status: invitation.invitation.status as InvitationDetails['status'],
      isRegistered,
    };
  }

  // ─── Password reset (DEC-023) ──────────────────────────────────────────────

  /**
   * Request a password reset.
   *
   * Anti-enumeration: always resolves with the same neutral message whether or
   * not the email belongs to an existing, non-deleted account. Rate-limited
   * per email+IP; over-limit requests are silently dropped with the same
   * neutral response. The raw token is never stored — only its SHA-256 hash.
   */
  async requestPasswordReset(input: { email: string }, clientIp?: string): Promise<ForgotPasswordResponse> {
    const normalizedEmail = input.email.toLowerCase().trim();

    if (!isForgotPasswordRateLimited(`${normalizedEmail}:${clientIp ?? 'unknown'}`)) {
      const user = await this.userRepo.findActiveByEmail(normalizedEmail);

      if (user) {
        const token = randomBytes(32).toString('hex');
        const tokenHash = await hashToken(token);

        await this.userRepo.setPasswordReset(user.id, tokenHash, new Date());

        if (this.mailer) {
          await this.mailer.sendPasswordResetEmail({
            to: user.email,
            resetUrl: `${this.frontendUrl}/auth/reset-password?token=${token}`,
            expiresInMinutes: PASSWORD_RESET_TTL_MINUTES,
          });
        }
      }
    }

    return {
      message: `If an account exists for that email, a password reset link has been sent. It expires in ${PASSWORD_RESET_TTL_MINUTES} minutes.`,
    };
  }

  /**
   * Reset a password with a single-use, expiring token.
   * Unknown / expired / already-used tokens all yield the same neutral error.
   */
  async resetPassword(input: { token: string; newPassword: string }): Promise<{ message: string }> {
    const tokenHash = await hashToken(input.token);
    const user = await this.userRepo.findByPasswordResetToken(tokenHash);
    const expired =
      !user ||
      !user.passwordReset ||
      Date.now() - user.passwordReset.requestedOn.getTime() > PASSWORD_RESET_TTL_MINUTES * 60 * 1000;

    if (expired) {
      throw new BadRequestError('Invalid or expired reset token', 'INVALID_RESET_TOKEN');
    }

    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_SALT_ROUNDS);

    // Single-use: clears the token as part of the update
    await this.userRepo.updatePasswordAndClearReset(user.id, passwordHash);

    return { message: 'Password has been reset.' };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private async generateToken(user: User, tenantId: string | null, tenantRole: TenantRole | null): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      displayName: user.displayName,
      tenantId,
      tenantRole,
      iat: now,
      exp: now + JWT_TTL_SECONDS,
    };

    return sign(payload, this.jwtSecret, 'HS256');
  }
}
