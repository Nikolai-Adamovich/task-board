import { createMiddleware } from 'hono/factory';
import { verify } from 'hono/jwt';
import type { JWTPayload } from 'hono/utils/jwt/types';
import { UnauthorizedError } from './error-handler.js';
import { resolveTenantMembership } from './tenant-context.js';
import type { AppEnv } from '../types/context.js';

// ─── JWT Verification (hono/jwt — Workers compatible) ────────────────────────

/**
 * Claims carried by the access token (see AuthService#generateToken), derived
 * from hono's `JWTPayload` with the required claims narrowed to `string`.
 * `verify()` returns the wide `JWTPayload`, so `authMiddleware` validates the
 * required claims at runtime before using the payload.
 */
type JwtPayload = JWTPayload & {
  sub: string;
  email: string;
  displayName?: string;
  avatarUrl?: string | null;
};

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
    const verified = await verify(token, jwtSecret, 'HS256');

    if (typeof verified.sub !== 'string' || typeof verified.email !== 'string') {
      throw new Error('Token is missing required claims');
    }

    payload = verified as JwtPayload;
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }

  // Verify the user still exists and is not soft-deleted. The JWT alone cannot
  // be trusted for this: a deleted user's token would otherwise stay valid
  // until expiry (24h). The lookup is cheap — unique index on `users.id`.
  const userPromise = c.get('svc').auth.findActiveUser(payload.sub);
  // TEMPORARY perf optimization: the tenant membership lookup is independent
  // of the user document (it needs only the JWT `sub` claim + X-Tenant-Id),
  // so it starts IN PARALLEL with the user lookup. The tenant-context
  // middleware reuses the pre-resolved document; the 403 membership checks
  // (existence, status, lazy revoke) stay in tenant-context — auth never
  // rejects based on membership.
  const tenantRef = c.req.header('X-Tenant-Id');
  const membershipPromise = tenantRef ? resolveTenantMembership(payload.sub, tenantRef) : Promise.resolve(null);
  const [user, membershipDoc] = await Promise.all([userPromise, membershipPromise]);

  if (!user) {
    throw new UnauthorizedError('User account no longer exists');
  }

  // Set context variables for downstream middleware and handlers
  c.set('userId', payload.sub);
  c.set('user', user);
  if (membershipDoc) {
    c.set('tenantMembershipDoc', membershipDoc);
  }

  await next();
});
