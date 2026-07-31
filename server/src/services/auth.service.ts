import { MemberStatus } from '@task-board/shared';
import type {
  User,
  AuthResponse,
  RegisterRequest,
  LoginRequest,
  InvitationDetails,
  TenantRole,
} from '@task-board/shared';
import { ConflictError, NotFoundError, UnauthorizedError } from '../middleware/error-handler.js';
import { UserRepository } from '../repositories/user.repository.js';
import { TenantRepository } from '../repositories/tenant.repository.js';
import { TenantMemberRepository } from '../repositories/tenant-member.repository.js';

// ─── JWT Utilities (Web Crypto API — Workers compatible) ─────────────────────

interface JwtPayload {
  sub: string;
  email: string;
  displayName: string;
  tenantId: string | null;
  tenantRole: TenantRole | null;
  iat: number;
  exp: number;
}

function base64UrlEncode(data: string): string {
  return btoa(data).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Sign a JWT using Web Crypto API (HMAC-SHA256).
 * Compatible with Cloudflare Workers.
 */
async function signJwt(payload: JwtPayload, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const data = encoder.encode(`${headerB64}.${payloadB64}`);
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, data);
  // Convert ArrayBuffer to base64url
  const signatureArray = new Uint8Array(signatureBuffer);
  const signatureB64 = btoa(String.fromCharCode(...signatureArray))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const BCRYPT_SALT_ROUNDS = 10;
const TOKEN_EXPIRY_SECONDS = 24 * 60 * 60; // 24 hours

// ─── Auth Service ────────────────────────────────────────────────────────────

export class AuthService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly tenantRepo: TenantRepository,
    private readonly tenantMemberRepo: TenantMemberRepository,
    private readonly jwtSecret: string,
  ) {}

  /**
   * Register a new user.
   * Creates the user and activates any pending invitations for the email.
   * If no pending invitations exist, issues a JWT with tenantId: null.
   */
  async register(input: RegisterRequest): Promise<AuthResponse> {
    // Check if email is already taken
    const existingUser = await this.userRepo.findByEmail(input.email);

    if (existingUser) {
      throw new ConflictError('A user with this email already exists');
    }

    // bcryptjs is a pure-JS implementation — no native bindings, Workers-compatible
    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);
    // Create the user
    const user = await this.userRepo.create({
      email: input.email,
      displayName: input.displayName,
      passwordHash,
    });
    // Check for pending invitations and activate them
    const pendingInvitations = await this.tenantMemberRepo.findPendingByEmail(input.email);
    let firstTenantId: string | null = null;
    let firstTenantRole: TenantRole | null = null;

    for (const invitation of pendingInvitations) {
      if (!invitation.invitationToken) continue;
      await this.tenantMemberRepo.activateInvitation(invitation.invitationToken, user.id);
      if (!firstTenantId) {
        firstTenantId = invitation.tenantId;
        firstTenantRole = invitation.role as TenantRole;
      }
    }

    // Generate JWT
    const token = await this.generateToken(user, firstTenantId, firstTenantRole);

    return { token, user };
  }

  /**
   * Log in with email and password.
   */
  async login(input: LoginRequest): Promise<AuthResponse> {
    const userDoc = await this.userRepo.findByEmail(input.email);

    if (!userDoc) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const bcrypt = await import('bcryptjs');
    const passwordValid = await bcrypt.compare(input.password, userDoc.passwordHash);

    if (!passwordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Find the user's first active tenant membership for the token
    const memberships = await this.tenantMemberRepo.findByUser(userDoc.id);
    const activeMembership = memberships.find((m) => m.status === MemberStatus.Active);
    const user: User = {
      id: userDoc.id,
      email: userDoc.email,
      displayName: userDoc.displayName,
      createdAt: userDoc.createdAt.toISOString(),
      updatedAt: userDoc.updatedAt.toISOString(),
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
   * If the user doesn't exist yet, creates a new account using the provided password and displayName.
   */
  async acceptInvitation(input: { token: string; password?: string; displayName?: string }): Promise<AuthResponse> {
    // Find the pending invitation by token
    const invitation = await this.tenantMemberRepo.findByInvitationToken(input.token);

    if (!invitation || invitation.status !== MemberStatus.Pending) {
      throw new NotFoundError('Invalid or expired invitation');
    }

    if (!invitation.invitedEmail) {
      throw new NotFoundError('Invitation has no associated email');
    }

    const invitedEmail = invitation.invitedEmail;
    let user: User;
    // Check if a user with the invited email already exists
    const existingUser = await this.userRepo.findByEmail(invitedEmail);

    if (existingUser) {
      // Existing user — activate the membership
      user = {
        id: existingUser.id,
        email: existingUser.email,
        displayName: existingUser.displayName,
        createdAt: existingUser.createdAt.toISOString(),
        updatedAt: existingUser.updatedAt.toISOString(),
      };
      await this.tenantMemberRepo.activateInvitation(input.token, existingUser.id);
    } else {
      // New user — password and displayName are required
      if (!input.password || !input.displayName) {
        throw new ConflictError('Password and display name are required for new accounts');
      }

      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);

      user = await this.userRepo.create({
        email: invitedEmail,
        displayName: input.displayName,
        passwordHash,
      });

      await this.tenantMemberRepo.activateInvitation(input.token, user.id);
    }

    // Generate JWT with the tenant from the invitation
    const token = await this.generateToken(user, invitation.tenantId, invitation.role as TenantRole);

    return { token, user };
  }

  /**
   * Get invitation details by token.
   */
  async getInvitationDetails(token: string): Promise<InvitationDetails> {
    const invitation = await this.tenantMemberRepo.findByInvitationToken(token);

    if (!invitation) {
      throw new NotFoundError('Invitation not found');
    }

    if (!invitation.invitedEmail) {
      throw new NotFoundError('Invitation has no associated email');
    }

    const tenant = await this.tenantRepo.findById(invitation.tenantId);

    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    // Check if the invited email corresponds to a registered user
    const existingUser = await this.userRepo.findByEmail(invitation.invitedEmail);

    return {
      email: invitation.invitedEmail,
      tenantName: tenant.name,
      role: invitation.role as InvitationDetails['role'],
      status: invitation.status as InvitationDetails['status'],
      isRegistered: existingUser !== null,
    };
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
      exp: now + TOKEN_EXPIRY_SECONDS,
    };

    return signJwt(payload, this.jwtSecret);
  }
}
