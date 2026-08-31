/**
 * Standalone database migration runner.
 *
 * Migrations are NOT executed in the Worker request path anymore — they run
 * once per deploy from CI (cd.yml) or locally, using the exact same
 * `runMigrations()` implementation the Worker used to call (no duplication).
 *
 * Usage:
 *   MONGODB_URI=mongodb://… npx -y tsx scripts/migrate.ts
 *
 * Exit codes: 0 = migrations applied (or already applied), 1 = failure.
 * A non-zero exit fails the CD job before the Worker deploy happens.
 */

import { MongoClient } from 'mongodb';
import { runMigrations } from '../src/db/migrations.js';

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error('MONGODB_URI is not set — refusing to run migrations.');
  process.exit(1);
}

const client = new MongoClient(uri, {
  connectTimeoutMS: 10_000,
  serverSelectionTimeoutMS: 10_000,
});

try {
  const startedAt = Date.now();

  await client.connect();
  await runMigrations(client.db());
  // eslint-disable-next-line no-console -- CLI script: stdout is the intended sink
  console.log(`Migrations completed in ${Date.now() - startedAt}ms`);
} finally {
  await client.close();
}
