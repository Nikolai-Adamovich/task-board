import { describe, it, expect } from 'vitest';
import { HttpMethod, HttpMethodSchema, HttpMethodValues } from './http.js';

describe('HttpMethod', () => {
  it('should define GET', () => {
    expect(HttpMethod.Get).toBe('GET');
  });

  it('should define POST', () => {
    expect(HttpMethod.Post).toBe('POST');
  });

  it('should define PUT', () => {
    expect(HttpMethod.Put).toBe('PUT');
  });

  it('should define PATCH', () => {
    expect(HttpMethod.Patch).toBe('PATCH');
  });

  it('should define DELETE', () => {
    expect(HttpMethod.Delete).toBe('DELETE');
  });

  it('should have exactly five methods', () => {
    expect(HttpMethodValues).toHaveLength(5);
  });

  it('should contain GET, POST, PUT, PATCH, DELETE', () => {
    expect([...HttpMethodValues].sort()).toEqual(['DELETE', 'GET', 'PATCH', 'POST', 'PUT']);
  });

  it('should have a valid Zod schema', () => {
    expect(HttpMethodSchema.parse('GET')).toBe('GET');
    expect(HttpMethodSchema.parse('POST')).toBe('POST');
    expect(HttpMethodSchema.parse('PUT')).toBe('PUT');
    expect(HttpMethodSchema.parse('PATCH')).toBe('PATCH');
    expect(HttpMethodSchema.parse('DELETE')).toBe('DELETE');
    expect(() => HttpMethodSchema.parse('OPTIONS')).toThrow();
  });
});
