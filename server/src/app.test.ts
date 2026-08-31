import { describe, it, expect } from 'vitest';
import { shouldProxyToDurable } from './app.js';

/**
 * Routing contract for the Worker entrypoint (DB_CLIENT_MODE=durable):
 * everything is proxied into the Durable Object EXCEPT the no-DB liveness
 * endpoints, which must stay on the Worker so true liveness never depends
 * on the DO (or MongoDB) being up. Any other mode never proxies.
 */
describe('shouldProxyToDurable', () => {
  it('proxies regular API routes to the DO in durable mode', () => {
    expect(shouldProxyToDurable('durable', '/api/tenants')).toBe(true);
    expect(shouldProxyToDurable('durable', '/api/auth/login')).toBe(true);
    expect(shouldProxyToDurable('durable', '/api/projects/x/preferences')).toBe(true);
    expect(shouldProxyToDurable('durable', '/api/readyz')).toBe(true);
  });

  it('keeps the no-DB liveness endpoints on the Worker in durable mode', () => {
    expect(shouldProxyToDurable('durable', '/api/ping')).toBe(false);
    expect(shouldProxyToDurable('durable', '/api/health')).toBe(false);
  });

  it('never proxies in any other mode (per-request production path)', () => {
    expect(shouldProxyToDurable('per-request', '/api/tenants')).toBe(false);
    expect(shouldProxyToDurable('per-request', '/api/ping')).toBe(false);
    expect(shouldProxyToDurable(undefined, '/api/tenants')).toBe(false);
    expect(shouldProxyToDurable('singleton', '/api/tenants')).toBe(false);
  });
});
