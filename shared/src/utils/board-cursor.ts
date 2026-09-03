/**
 * Opaque board pagination cursor.
 *
 * The cursor carries the sort keys of the last card of a loaded column page
 * (`priorityLevel` + `number`) so the next page can resume with a keyset
 * predicate — no offsets, no skips. It is intentionally opaque: callers pass
 * the base64url string back verbatim and never read raw keys from the URL.
 *
 * The wire payload is versioned (`v`) so the format can be extended without
 * breaking old cursors — bump the version and branch in
 * {@link decodeBoardCursor}. No globals are used (`btoa`/`Buffer` differ
 * across Workers/Node/browsers); the base64url codec below is self-contained.
 */
import { TASK_PRIORITY_LEVELS, type TaskPriorityLevel } from '../constants/priority.js';

/** Sort keys of the last card of a loaded board column page. */
export interface BoardPageCursor {
  priorityLevel: TaskPriorityLevel;
  number: number;
}

/** Thrown when a cursor is malformed or tampered with — maps to HTTP 400. */
export class InvalidBoardCursorError extends Error {
  constructor(message = 'Invalid board cursor') {
    super(message);
    this.name = 'InvalidBoardCursorError';
  }
}

/** Wire format version — bump when the payload shape changes. */
const CURSOR_VERSION = 1;
/** Generous upper bound: the canonical payload is ~32 chars. */
const MAX_CURSOR_LENGTH = 64;
const BASE64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function encodeBytes(bytes: Uint8Array): string {
  let out = '';

  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = bytes[i + 1] ?? 0;
    const b2 = bytes[i + 2] ?? 0;
    const triplet = (b0 << 16) | (b1 << 8) | b2;

    out += BASE64URL_ALPHABET[(triplet >> 18) & 63];
    out += BASE64URL_ALPHABET[(triplet >> 12) & 63];

    if (i + 1 < bytes.length) out += BASE64URL_ALPHABET[(triplet >> 6) & 63];
    if (i + 2 < bytes.length) out += BASE64URL_ALPHABET[triplet & 63];
  }

  return out;
}

function decodeBytes(text: string): Uint8Array {
  const values = new Uint8Array(text.length);

  for (let i = 0; i < text.length; i += 1) {
    const index = BASE64URL_ALPHABET.indexOf(text[i] ?? '');

    if (index < 0) throw new InvalidBoardCursorError('Board cursor is not base64url');
    values[i] = index;
  }

  const bytes: number[] = [];

  for (let i = 0; i < values.length; i += 4) {
    const c0 = values[i] ?? 0;
    const c1 = values[i + 1] ?? 0;
    const c2 = values[i + 2];
    const c3 = values[i + 3];
    const triplet = (c0 << 18) | (c1 << 12) | ((c2 ?? 0) << 6) | (c3 ?? 0);

    bytes.push((triplet >> 16) & 255);
    if (c2 !== undefined) bytes.push((triplet >> 8) & 255);
    if (c3 !== undefined) bytes.push(triplet & 255);
  }

  return Uint8Array.from(bytes);
}

function isValidLevel(value: unknown): value is TaskPriorityLevel {
  return (
    typeof value === 'number' && Number.isInteger(value) && (TASK_PRIORITY_LEVELS as readonly number[]).includes(value)
  );
}

function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1;
}

/**
 * Encode sort keys into an opaque cursor string.
 *
 * @throws {@link InvalidBoardCursorError} when the keys are out of range
 * (programmer error — the typed signature already narrows them).
 */
export function encodeBoardCursor(cursor: BoardPageCursor): string {
  if (!isValidLevel(cursor.priorityLevel) || !isValidNumber(cursor.number)) {
    throw new InvalidBoardCursorError('Board cursor keys are out of range');
  }

  const json = JSON.stringify({ v: CURSOR_VERSION, p: cursor.priorityLevel, n: cursor.number });
  const bytes = new Uint8Array(json.length);

  for (let i = 0; i < json.length; i += 1) {
    const code = json.charCodeAt(i);

    // The payload is digits and JSON punctuation by construction (ASCII-only).
    if (code > 255) throw new InvalidBoardCursorError('Board cursor payload is not encodable');
    bytes[i] = code;
  }

  return encodeBytes(bytes);
}

/**
 * Decode and validate an opaque cursor string.
 *
 * @throws {@link InvalidBoardCursorError} for empty, overlong, non-base64url,
 * non-JSON or out-of-range payloads (malformed/tampered input → HTTP 400).
 */
export function decodeBoardCursor(value: unknown): BoardPageCursor {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_CURSOR_LENGTH) {
    throw new InvalidBoardCursorError('Board cursor must be a short non-empty string');
  }

  const json = String.fromCharCode(...decodeBytes(value));
  let parsed: unknown;

  try {
    parsed = JSON.parse(json) as unknown;
  } catch {
    throw new InvalidBoardCursorError('Board cursor payload is not JSON');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new InvalidBoardCursorError('Board cursor payload must be an object');
  }

  const record = parsed as Record<string, unknown>;

  if (record['v'] !== CURSOR_VERSION || !isValidLevel(record['p']) || !isValidNumber(record['n'])) {
    throw new InvalidBoardCursorError('Board cursor payload is out of range');
  }

  return { priorityLevel: record['p'], number: record['n'] };
}
