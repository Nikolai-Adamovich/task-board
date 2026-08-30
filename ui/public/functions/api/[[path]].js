/**
 * Pages Function proxy — same-origin /api/* → Workers backend.
 *
 * Angular calls relative `/api/...` (environment.prod.ts), so the browser only
 * ever talks to the Pages origin: no CORS, no preflights. This catch-all
 * function forwards every /api/* request to the deployed Worker, preserving
 * method, headers (Authorization, X-Tenant-Id), query string and body.
 *
 * The target URL is read at RUNTIME from the Pages project environment
 * variable `API_WORKER_URL` (Dashboard → app-board → Settings → Environment
 * variables → Production), e.g. `https://task-board-api.<subdomain>.workers.dev`.
 * It is intentionally NOT a build-time value: the GitHub build never needs it.
 *
 * The file lives in `public/functions/` so the Angular build copies it to the
 * deploy root (`dist/ui/browser/functions/…`), where `wrangler pages deploy`
 * picks it up as a Pages Function.
 */
export async function onRequest(context) {
  const { request, env } = context;
  const base = env.API_WORKER_URL;

  if (!base) {
    return Response.json(
      { error: { code: 'PROXY_MISCONFIGURED', message: 'API_WORKER_URL is not set on the Pages project' } },
      { status: 500 },
    );
  }

  const incoming = new URL(request.url);
  const target = new URL(base);

  // The Worker serves the same /api/* routes — path and query map 1:1.
  target.pathname = incoming.pathname;
  target.search = incoming.search;

  return fetch(target, request);
}
