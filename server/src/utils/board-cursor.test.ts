/**
 * Board cursor contract tests (shared helpers, exercised via the built
 * `@task-board/shared` dist — the same artifact that ships to Workers).
 *
 * Covers: encode/decode round-trip, level/number boundaries, malformed and
 * tampered input, opacity (no raw keys in the URL string) and the fixed
 * board page size.
 */
import { describe, it, expect } from 'vitest';
import {
  BOARD_PAGE_SIZE,
  encodeBoardCursor,
  decodeBoardCursor,
  InvalidBoardCursorError,
  TASK_PRIORITY_LEVELS,
} from '@task-board/shared';

describe('board cursor', () => {
  it('round-trips every priority level with small and large task numbers', () => {
    for (const level of TASK_PRIORITY_LEVELS) {
      for (const number of [1, 2, 184, 50000]) {
        expect(decodeBoardCursor(encodeBoardCursor({ priorityLevel: level, number }))).toEqual({
          priorityLevel: level,
          number,
        });
      }
    }
  });

  it('is opaque base64url — no JSON or raw keys leak into the URL string', () => {
    const encoded = encodeBoardCursor({ priorityLevel: 2, number: 184 });

    expect(encoded).toMatch(/^[A-Za-z0-9-_]+$/);
    expect(encoded).not.toContain('{');
    expect(encoded.length).toBeLessThanOrEqual(64);
  });

  it('rejects empty, non-string and overlong input', () => {
    expect(() => decodeBoardCursor('')).toThrow(InvalidBoardCursorError);
    expect(() => decodeBoardCursor(null)).toThrow(InvalidBoardCursorError);
    expect(() => decodeBoardCursor(undefined)).toThrow(InvalidBoardCursorError);
    expect(() => decodeBoardCursor(42)).toThrow(InvalidBoardCursorError);
    expect(() => decodeBoardCursor('x'.repeat(65))).toThrow(InvalidBoardCursorError);
  });

  it('rejects non-base64url characters (tampered query params)', () => {
    expect(() => decodeBoardCursor('not a cursor!!!')).toThrow(InvalidBoardCursorError);
    expect(() => decodeBoardCursor('ab+c/def=')).toThrow(InvalidBoardCursorError);
  });

  it('rejects payloads outside the cursor shape', () => {
    // Valid base64url that decodes to non-JSON / wrong-shape JSON.
    const toCursor = (raw: string): string =>
      Buffer.from(raw, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    for (const raw of [
      'plain-text',
      '[1,2,3]',
      '"just-a-string"',
      '42',
      'null',
      JSON.stringify({ v: 999, p: 2, n: 184 }),
      JSON.stringify({ v: 1, p: 2 }),
      JSON.stringify({ v: 1, n: 184 }),
      JSON.stringify({ v: 1, p: 2, n: 184, extra: true }),
    ]) {
      // The last case is structurally valid (unknown fields ignored) — the
      // rest must throw.
      if (raw.includes('extra')) {
        expect(decodeBoardCursor(toCursor(raw))).toEqual({ priorityLevel: 2, number: 184 });
      } else {
        expect(() => decodeBoardCursor(toCursor(raw))).toThrow(InvalidBoardCursorError);
      }
    }
  });

  it('rejects out-of-range levels and numbers at decode time', () => {
    const toCursor = (payload: unknown): string =>
      Buffer.from(JSON.stringify(payload), 'utf8')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    for (const payload of [
      { v: 1, p: 4, n: 1 },
      { v: 1, p: -1, n: 1 },
      { v: 1, p: 1.5, n: 1 },
      { v: 1, p: '2', n: 1 },
      { v: 1, p: 2, n: 0 },
      { v: 1, p: 2, n: -5 },
      { v: 1, p: 2, n: 1.5 },
      { v: 1, p: 2, n: '184' },
    ]) {
      expect(() => decodeBoardCursor(toCursor(payload))).toThrow(InvalidBoardCursorError);
    }
  });

  it('rejects out-of-range keys at encode time', () => {
    expect(() => encodeBoardCursor({ priorityLevel: 4 as never, number: 1 })).toThrow(InvalidBoardCursorError);
    expect(() => encodeBoardCursor({ priorityLevel: 1, number: 0 })).toThrow(InvalidBoardCursorError);
  });

  it('fixes the board page size at 50 cards per column', () => {
    expect(BOARD_PAGE_SIZE).toBe(50);
  });
});
