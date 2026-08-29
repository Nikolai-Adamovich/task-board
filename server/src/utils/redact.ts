/**
 * M-05: redact Bearer credentials from log output.
 *
 * `hono/logger` prints one line per log entry (`<-- GET /path`,
 * `--> GET /path 200 5ms`). It does not print headers today, but any token
 * that ever reaches a log line (query string, future header logging, error
 * messages) must never appear in cleartext.
 */
export function redactAuthorization(str: string): string {
  return str.replace(/Bearer\s+[^\s,"']+/gi, 'Bearer <redacted>');
}
