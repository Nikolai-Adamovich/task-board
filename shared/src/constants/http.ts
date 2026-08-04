import { valuesOf } from '../utils/values-of.js';

/** Supported HTTP methods for API contracts */
export const HttpMethod = {
  Get: 'GET',
  Post: 'POST',
  Put: 'PUT',
  Patch: 'PATCH',
  Delete: 'DELETE',
} as const;

export type HttpMethod = (typeof HttpMethod)[keyof typeof HttpMethod];
export const HttpMethodValues = valuesOf(HttpMethod);
