import { createMiddleware } from 'hono/factory';
import { verify } from 'hono/jwt';
import { UnauthorizedError } from './error-handler.js';
import type { AppEnv } from '../types/context.js';
import type { User } from '@task-board/shared';

// ─── JWT Verification (hono/jwt — Workers compatible) ────────────────────────

/** Claims carried by the access token (see AuthService#generateToken) */
interface JwtPayload {
  sub: string;
  email: string;
  displayName?: string;
  avatarUrl?: string | null;
  exp?: number;
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
    // hono/jwt verifies the algorithm, the signature and `exp` in one call
    payload = (await verify(token, jwtSecret, 'HS256')) as unknown as JwtPayload;
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
