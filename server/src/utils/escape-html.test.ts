import { describe, it, expect } from 'vitest';
import { escapeHtml } from './escape-html.js';

// Expected entities are built via concatenation so this source file never
// contains a raw HTML entity (which would be decoded before reaching the test).
const AMP = '&' + 'amp;';
const LT = '&' + 'lt;';
const GT = '&' + 'gt;';
const QUOT = '&' + 'quot;';
const APOS = '&' + '#39;';

describe('escapeHtml', () => {
  it('escapes angle brackets', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(`${LT}script${GT}alert(1)${LT}/script${GT}`);
  });

  it('escapes ampersands', () => {
    expect(escapeHtml('Tom & Jerry')).toBe(`Tom ${AMP} Jerry`);
  });

  it('escapes double quotes', () => {
    expect(escapeHtml('say "hi"')).toBe(`say ${QUOT}hi${QUOT}`);
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe(`it${APOS}s`);
  });

  it('escapes a full injection payload', () => {
    const payload = '"><script>&\'';
    const escaped = escapeHtml(payload);

    expect(escaped).not.toContain('<');
    expect(escaped).not.toContain('>');
    expect(escaped).not.toContain('"');
    expect(escaped).not.toContain("'");
    expect(escaped).toBe(`${QUOT}${GT}${LT}script${GT}${AMP}${APOS}`);
  });

  it('leaves safe values unchanged', () => {
    expect(escapeHtml('Acme Corp 123')).toBe('Acme Corp 123');
  });

  it('handles empty strings', () => {
    expect(escapeHtml('')).toBe('');
  });
});
