/**
 * Escape special regex characters in user-provided input before it is
 * interpolated into a MongoDB `$regex` filter.
 *
 * Without escaping, raw user input is compiled as a regular expression:
 * invalid patterns cause 500s (`Invalid $regex`) and crafted patterns
 * (`(?=.*)*`-style) cause CPU exhaustion on the database (ReDoS).
 */
export function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
