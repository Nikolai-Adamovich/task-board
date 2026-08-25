import { sign } from 'hono/jwt';
import { MemberStatus, InvitationStatus } from '@task-board/shared';
import type {
  User,
  AuthResponse,
  RegisterRequest,
  LoginRequest,
  InvitationDetails,
  TenantRole,
} from '@task-board/shared';
import { ConflictError, NotFoundError, UnauthorizedError } from '../errors/app-error.js';
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
const TOKEN_EXPIRY_SECONDS = 24 * 60 * 60; // 24 hours

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
  ) {}

  /**
   * Register a new user.
   * Creates the user and activates any pending invitations for the email.
   */
  async register(input: RegisterRequest): Promise<AuthResponse> {
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
   */
  async login(input: LoginRequest): Promise<AuthResponse> {
    const normalizedEmail = input.email.toLowerCase().trim();
    const userDoc = await this.userRepo.findByEmail(normalizedEmail);

    if (!userDoc) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const bcrypt = await import('bcryptjs');
    const passwordValid = await bcrypt.compare(input.password, userDoc.passwordHash);

    if (!passwordValid) {
      throw new UnauthorizedError('Invalid email or password');
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

    const user = await this.userRepo.findById(invitation.userId);

    if (!user) {
      throw new NotFoundError('Invitation user not found');
    }

    // Note: In v5, the invite flow creates a real user record.
    // Password handling for placeholder accounts is done at the invite creation time.

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

    const user = await this.userRepo.findById(invitation.userId);
    const isRegistered = user !== null;

    return {
      email: user?.email ?? '',
      tenantName: tenant.name,
      role: invitation.role as InvitationDetails['role'],
      status: invitation.invitation.status as InvitationDetails['status'],
      isRegistered,
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

    return sign(payload, this.jwtSecret, 'HS256');
  }
}
