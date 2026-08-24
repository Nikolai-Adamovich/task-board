import { describe, expect, it } from 'vitest';
import { HttpErrorResponse } from '@angular/common/http';
import { getErrorMessage, initials } from './error-utils';

describe('getErrorMessage', () => {
  it('should prefer the userMessage attached by the error interceptor', () => {
    const err = new HttpErrorResponse({ status: 409, statusText: 'Conflict' });

    (err as HttpErrorResponse & { userMessage?: string }).userMessage = 'errors.taskVersionConflict';

    expect(getErrorMessage(err)).toBe('errors.taskVersionConflict');
  });

  it('should fall back to the payload message', () => {
    const err = new HttpErrorResponse({ status: 500, error: { message: 'boom' } });

    expect(getErrorMessage(err)).toBe('boom');
  });

  it('should fall back to the HTTP message', () => {
    const err = new HttpErrorResponse({ status: 500, statusText: 'Server Error' });

    expect(getErrorMessage(err)).toBe('Http failure response for (unknown url): 500 Server Error');
  });

  it('should return the Error message for generic errors', () => {
    expect(getErrorMessage(new Error('nope'))).toBe('nope');
  });

  it('should return the fallback key for unknown values', () => {
    expect(getErrorMessage(undefined, 'errors.custom')).toBe('errors.custom');
    expect(getErrorMessage('weird')).toBe('errors.unexpected');
  });
});

describe('initials', () => {
  it('should return two initials for a full name', () => {
    expect(initials('Jane Doe')).toBe('JD');
  });

  it('should return the first two characters for a single name', () => {
    expect(initials('Alice')).toBe('AL');
  });

  it('should handle extra whitespace', () => {
    expect(initials('  Jane   Doe  ')).toBe('JD');
  });

  it('should return ?? for null or empty names', () => {
    expect(initials(null)).toBe('??');
    expect(initials('')).toBe('??');
  });
});
