import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import type { User, AuthResponse, RegisterRequest, LoginRequest } from '@task-board/shared';
import { ConflictError, NotFoundError, UnauthorizedError } from '../middleware/error-handler.js';
import { UserRepository } from '../repositories/user.repository.js';
import { TenantRepository } from '../repositories/tenant.repository.js';
import { TenantMemberRepository } from '../repositories/tenant-member.repository.js';

// ─── JWT Utilities (Web Crypto API — Workers compatible) ─────────────────────

interface JwtPayload {
  sub: string;
  email: string;
  displayName: string;
  tenantId: string;
  tenantRole: string;
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
   * Creates the user, auto-creates a personal tenant, and adds the user as owner.
   */
  async register(input: RegisterRequest): Promise<AuthResponse> {
    // Check if email is already taken
    const existingUser = await this.userRepo.findByEmail(input.email);
    if (existingUser) {
      throw new ConflictError('A user with this email already exists');
    }

    // Hash the password
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);

    // Create the user
    const user = await this.userRepo.create({
      email: input.email,
      displayName: input.displayName,
      passwordHash,
    });

    // Auto-create a personal tenant using the user's display name
    const slug = this.generateSlug(input.displayName);
    const tenant = await this.tenantRepo.create({
      name: `${input.displayName}'s Workspace`,
      slug,
    });

    // Add user as owner of the tenant
    await this.tenantMemberRepo.create({
      userId: user.id,
      tenantId: tenant.id,
      role: 'owner',
    });

    // Generate JWT
    const token = await this.generateToken(user, tenant.id, 'owner');

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

    const passwordValid = await bcrypt.compare(input.password, userDoc.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Find the user's first tenant membership for the token
    const memberships = await this.tenantMemberRepo.findByUser(userDoc.id);
    const membership = memberships[0];

    const user: User = {
      id: userDoc.id,
      email: userDoc.email,
      displayName: userDoc.displayName,
      createdAt: userDoc.createdAt.toISOString(),
      updatedAt: userDoc.updatedAt.toISOString(),
    };

    const token = await this.generateToken(user, membership?.tenantId ?? '', membership?.role ?? 'member');

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

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private async generateToken(user: User, tenantId: string, tenantRole: string): Promise<string> {
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

  private generateSlug(displayName: string): string {
    const base = displayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const suffix = randomUUID().slice(0, 8);
    return `${base}-${suffix}`;
  }
}
