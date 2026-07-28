/**
 * Tests for the slug validator.
 *
 * Slugs are URL-friendly identifiers used for tenants and projects.
 * Rules: lowercase letters, numbers, hyphens only; must start/end
 * with alphanumeric character; 2-80 characters.
 */
import { describe, it, expect } from 'vitest';
import { slug } from './slug.js';

describe('slug validator', () => {
  const slugSchema = slug();

  it('should accept a valid slug', () => {
    const result = slugSchema.safeParse('my-project');
    expect(result.success).toBe(true);
  });

  it('should accept slug with numbers', () => {
    const result = slugSchema.safeParse('project-2026');
    expect(result.success).toBe(true);
  });

  it('should accept minimum length slug (2 chars)', () => {
    const result = slugSchema.safeParse('ab');
    expect(result.success).toBe(true);
  });

  it('should accept maximum length slug (80 chars)', () => {
    const result = slugSchema.safeParse('a'.repeat(79) + 'b');
    expect(result.success).toBe(true);
  });

  it('should reject single character slug', () => {
    const result = slugSchema.safeParse('a');
    expect(result.success).toBe(false);
  });

  it('should reject slug exceeding 80 characters', () => {
    const result = slugSchema.safeParse('a'.repeat(81));
    expect(result.success).toBe(false);
  });

  it('should reject slug starting with hyphen', () => {
    const result = slugSchema.safeParse('-bad-slug');
    expect(result.success).toBe(false);
  });

  it('should reject slug ending with hyphen', () => {
    const result = slugSchema.safeParse('bad-slug-');
    expect(result.success).toBe(false);
  });

  it('should reject slug with uppercase letters', () => {
    const result = slugSchema.safeParse('Bad-Slug');
    expect(result.success).toBe(false);
  });

  it('should reject slug with spaces', () => {
    const result = slugSchema.safeParse('has spaces');
    expect(result.success).toBe(false);
  });

  it('should reject slug with special characters', () => {
    const result = slugSchema.safeParse('slug@#$');
    expect(result.success).toBe(false);
  });

  it('should reject empty string', () => {
    const result = slugSchema.safeParse('');
    expect(result.success).toBe(false);
  });
});
