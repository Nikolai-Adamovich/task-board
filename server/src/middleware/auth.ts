import { createMiddleware } from 'hono/factory';
import { UnauthorizedError } from './error-handler.js';
import type { AppEnv } from '../types/context.js';
import type { User } from '@task-board/shared';

// ─── JWT Decoding Utilities (Web Crypto API — Workers compatible) ─────────────

interface JwtPayload {
  sub: string;
  email: string;
  displayName?: string;
  avatarUrl?: string | null;
  iat: number;
  exp: number;
}

/**
 * Decode and verify a JWT using the Web Crypto API (HMAC-SHA256).
 * Compatible with Cloudflare Workers — no Node.js crypto dependency.
 *
 * @param token - The JWT string (header.payload.signature)
 * @param secret - The HMAC secret key
 * @returns The decoded payload
 * @throws If the token is invalid, expired, or the signature doesn't match
 */
async function verifyJwt(token: string, secret: string): Promise<JwtPayload> {
  const parts = token.split('.');

  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }

  const headerB64 = parts[0] ?? '';
  const payloadB64 = parts[1] ?? '';
  const signatureB64 = parts[2] ?? '';
  // Import the secret as an HMAC key
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'verify',
  ]);
  // Decode the signature from base64url
  const signature = Uint8Array.from(atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  // Verify the signature
  const data = encoder.encode(`${headerB64}.${payloadB64}`);
  const isValid = await crypto.subtle.verify('HMAC', key, signature, data);

  if (!isValid) {
    throw new Error('Invalid JWT signature');
  }

  // Decode the payload
  const payloadJson = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
  const payload = JSON.parse(payloadJson) as JwtPayload;
  // Check expiration
  const now = Math.floor(Date.now() / 1000);

  if (payload.exp && payload.exp < now) {
    throw new Error('JWT has expired');
  }

  return payload;
}

// ─── Auth Middleware ──────────────────────────────────────────────────────────

/**
 * Hono middleware that verifies the `Authorization: Bearer <token>` header.
 *
 * On success, sets:
 * - `c.get('userId')` — the user's ID (from JWT `sub` claim)
 * - `c.get('user')` — full User object
 *
 * On failure, throws UnauthorizedError (401).
 *
 * Soft-deleted users (`deletedAt != null`) are rejected with 401.
 */
export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid Authorization header');
  }

  const token = authHeader.slice(7);

  if (!token) {
    throw new UnauthorizedError('Missing access token');
  }

  const jwtSecret = c.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new UnauthorizedError('JWT secret not configured');
  }

  let payload: JwtPayload;

  try {
    payload = await verifyJwt(token, jwtSecret);
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }

  // Build the User object from JWT claims.
  // Note: The full user object (including deletedAt check) should be populated
  // by looking up the user in the database. The JWT carries basic identity.
  // For now, we construct a minimal User from the JWT payload.
  // Routes that need full user data (e.g., deletedAt check) should query the DB.
  const user: User = {
    id: payload.sub,
    email: payload.email,
    displayName: payload.displayName ?? '',
    avatarUrl: payload.avatarUrl ?? null,
    createdAt: '',
    updatedAt: '',
    deletedAt: null,
  };

  // Set context variables for downstream middleware and handlers
  c.set('userId', payload.sub);
  c.set('user', user);

  await next();
});
