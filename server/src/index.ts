/**
 * Worker entrypoint — a thin routing/proxy layer.
 *
 * - `DB_CLIENT_MODE=per-request` (production default): the Hono app runs
 *   directly in the Worker with a fresh MongoClient per request (the proven
 *   rollback path).
 * - `DB_CLIENT_MODE=durable`: everything except the no-DB liveness endpoints
 *   is proxied into {@link MongoHonoDurableObject}, which owns the Hono app
 *   and a persistent MongoClient + pool. The Request/Response pair is
 *   forwarded untouched — method, URL, headers, body and streaming are
 *   preserved, so the API contract is identical for clients.
 *
 * `/api/ping` and `/api/health` always stay on the Worker: true liveness must
 * not depend on the DO (or MongoDB) being up. `/api/readyz` is proxied — it
 * verifies a fresh MongoDB connection by design.
 */

import { app, shouldProxyToDurable } from './app.js';
import { MongoHonoDurableObject } from './do/mongo-do.js';
import type { AppEnv } from './types/context.js';

export { MongoHonoDurableObject };

export default {
  async fetch(request: Request, env: AppEnv['Bindings'], ctx: ExecutionContext): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (shouldProxyToDurable(env.DB_CLIENT_MODE, pathname)) {
      // `idFromName` gives one stable DO identity. The per-get coordination
      // cost is acceptable at current traffic; revisit cached
      // `idFromString` only if the benchmark shows it matters.
      const id = env.MONGO_DO.idFromName('mongo');
      // `weur` (Western Europe) is a best-effort hint towards the MongoDB
      // Atlas region (eu-central-1) — only the FIRST get() honours it.
      const stub = env.MONGO_DO.get(id, { locationHint: 'weur' });
      const response = await stub.fetch(request);

      return response;
    }

    return app.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<AppEnv['Bindings']>;
