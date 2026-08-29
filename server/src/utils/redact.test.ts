import { describe, it, expect } from 'vitest';
import { redactAuthorization } from './redact.js';

describe('redactAuthorization (M-05)', () => {
  it('redacts a Bearer token in a log line', () => {
    expect(redactAuthorization('--> GET /api/tasks?token=Bearer abc.def.ghi 200 5ms')).toBe(
      '--> GET /api/tasks?token=Bearer <redacted> 200 5ms',
    );
  });

  it('is case-insensitive', () => {
    expect(redactAuthorization('bearer secret-token')).toBe('Bearer <redacted>');
  });

  it('leaves lines without credentials untouched', () => {
    const line = '<-- GET /api/projects';

    expect(redactAuthorization(line)).toBe(line);
  });

  it('redacts only the token, not surrounding text', () => {
    expect(redactAuthorization('Authorization: Bearer xyz, Content-Type: application/json')).toBe(
      'Authorization: Bearer <redacted>, Content-Type: application/json',
    );
  });
});
