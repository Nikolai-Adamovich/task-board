import { z } from 'zod';

/**
 * Schema for support request body.
 */
export const SupportRequestSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be at most 200 characters'),
  email: z.email({ message: 'Invalid email address', pattern: z.regexes.html5Email }),
  message: z.string().min(1, 'Message is required').max(2000, 'Message must be at most 2000 characters'),
});

/** Inferred SupportRequest type */
export type SupportRequest = z.infer<typeof SupportRequestSchema>;
