/**
 * Tests for user preferences schemas: UserPreferencesSchema, UpdateUserPreferencesSchema.
 *
 * User preferences store per-user UI settings (zoom, theme, language).
 * Validating these schemas ensures correct data shapes for read and update operations.
 */
import { describe, it, expect } from 'vitest';
import { UserPreferencesSchema, UpdateUserPreferencesSchema } from './user-preferences.js';

// ─── UserPreferencesSchema ───────────────────────────────────────────────────

describe('UserPreferencesSchema', () => {
  const validPreferences = {
    userId: '550e8400-e29b-41d4-a716-446655440000',
    zoom: 100,
    theme: 'light' as const,
    language: 'en',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('should accept valid user preferences with all fields', () => {
    const result = UserPreferencesSchema.safeParse(validPreferences);

    expect(result.success).toBe(true);
  });

  it('should apply default zoom of 100 when omitted', () => {
    const result = UserPreferencesSchema.safeParse({
      userId: validPreferences.userId,
      theme: validPreferences.theme,
      language: validPreferences.language,
      updatedAt: validPreferences.updatedAt,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.zoom).toBe(100);
    }
  });

  it('should apply default theme of "light" when omitted', () => {
    const result = UserPreferencesSchema.safeParse({
      userId: validPreferences.userId,
      zoom: validPreferences.zoom,
      language: validPreferences.language,
      updatedAt: validPreferences.updatedAt,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.theme).toBe('light');
    }
  });

  it('should apply default language of "en" when omitted', () => {
    const result = UserPreferencesSchema.safeParse({
      userId: validPreferences.userId,
      zoom: validPreferences.zoom,
      theme: validPreferences.theme,
      updatedAt: validPreferences.updatedAt,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.language).toBe('en');
    }
  });

  it('should accept zoom at lower boundary (25)', () => {
    const result = UserPreferencesSchema.safeParse({ ...validPreferences, zoom: 25 });

    expect(result.success).toBe(true);
  });

  it('should accept zoom at upper boundary (500)', () => {
    const result = UserPreferencesSchema.safeParse({ ...validPreferences, zoom: 500 });

    expect(result.success).toBe(true);
  });

  it('should reject zoom below 25', () => {
    const result = UserPreferencesSchema.safeParse({ ...validPreferences, zoom: 24 });

    expect(result.success).toBe(false);
  });

  it('should reject zoom above 500', () => {
    const result = UserPreferencesSchema.safeParse({ ...validPreferences, zoom: 501 });

    expect(result.success).toBe(false);
  });

  it('should reject non-integer zoom', () => {
    const result = UserPreferencesSchema.safeParse({ ...validPreferences, zoom: 150.5 });

    expect(result.success).toBe(false);
  });

  it('should accept theme "dark"', () => {
    const result = UserPreferencesSchema.safeParse({ ...validPreferences, theme: 'dark' });

    expect(result.success).toBe(true);
  });

  it('should reject invalid theme', () => {
    const result = UserPreferencesSchema.safeParse({ ...validPreferences, theme: 'blue' });

    expect(result.success).toBe(false);
  });

  it('should reject invalid userId UUID', () => {
    const result = UserPreferencesSchema.safeParse({ ...validPreferences, userId: 'not-a-uuid' });

    expect(result.success).toBe(false);
  });

  it('should reject language shorter than 2 characters', () => {
    const result = UserPreferencesSchema.safeParse({ ...validPreferences, language: 'a' });

    expect(result.success).toBe(false);
  });

  it('should reject language longer than 10 characters', () => {
    const result = UserPreferencesSchema.safeParse({ ...validPreferences, language: 'a'.repeat(11) });

    expect(result.success).toBe(false);
  });

  it('should reject invalid datetime format', () => {
    const result = UserPreferencesSchema.safeParse({ ...validPreferences, updatedAt: 'not-a-date' });

    expect(result.success).toBe(false);
  });
});

// ─── UpdateUserPreferencesSchema ─────────────────────────────────────────────

describe('UpdateUserPreferencesSchema', () => {
  it('should accept partial update with zoom only', () => {
    const result = UpdateUserPreferencesSchema.safeParse({ zoom: 200 });

    expect(result.success).toBe(true);
  });

  it('should accept partial update with theme only', () => {
    const result = UpdateUserPreferencesSchema.safeParse({ theme: 'dark' });

    expect(result.success).toBe(true);
  });

  it('should accept partial update with language only', () => {
    const result = UpdateUserPreferencesSchema.safeParse({ language: 'pl' });

    expect(result.success).toBe(true);
  });

  it('should accept partial update with multiple fields', () => {
    const result = UpdateUserPreferencesSchema.safeParse({ zoom: 150, theme: 'dark', language: 'fr' });

    expect(result.success).toBe(true);
  });

  it('should accept empty update (all optional)', () => {
    const result = UpdateUserPreferencesSchema.safeParse({});

    expect(result.success).toBe(true);
  });

  it('should reject zoom below 25 in update', () => {
    const result = UpdateUserPreferencesSchema.safeParse({ zoom: 10 });

    expect(result.success).toBe(false);
  });

  it('should reject zoom above 500 in update', () => {
    const result = UpdateUserPreferencesSchema.safeParse({ zoom: 600 });

    expect(result.success).toBe(false);
  });

  it('should reject non-integer zoom in update', () => {
    const result = UpdateUserPreferencesSchema.safeParse({ zoom: 75.5 });

    expect(result.success).toBe(false);
  });

  it('should reject invalid theme in update', () => {
    const result = UpdateUserPreferencesSchema.safeParse({ theme: 'auto' });

    expect(result.success).toBe(false);
  });

  it('should reject language shorter than 2 characters in update', () => {
    const result = UpdateUserPreferencesSchema.safeParse({ language: 'x' });

    expect(result.success).toBe(false);
  });
});
