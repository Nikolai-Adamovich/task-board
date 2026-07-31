import { z } from 'zod';

/** Supported HTTP methods for API contracts */
export const HttpMethod = {
  Get: 'GET',
  Post: 'POST',
  Put: 'PUT',
  Patch: 'PATCH',
  Delete: 'DELETE',
} as const;

export type HttpMethod = (typeof HttpMethod)[keyof typeof HttpMethod];
export const HttpMethodSchema = z.enum(HttpMethod);
export const HttpMethodValues = Object.values(HttpMethod) as [HttpMethod, ...HttpMethod[]];
