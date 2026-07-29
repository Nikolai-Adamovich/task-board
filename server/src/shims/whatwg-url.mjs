/**
 * Shim for `whatwg-url` that adds a `default` export to suppress the
 * esbuild `[import-is-undefined]` warning during wrangler bundling.
 *
 * The warning occurs because `mongodb-connection-string-url` uses
 * `require("whatwg-url")` (CJS), and the `unenv` shim only provides
 * named exports (no `default`).
 *
 * @see server/wrangler.toml `[alias]` section
 */

const notImplemented = (name) => {
  const fn = () => {
    throw new Error(`[unenv] ${name} is not implemented yet!`);
  };
  return Object.assign(fn, { __unenv__: true });
};

export const URL = globalThis.URL;
export const URLSearchParams = globalThis.URLSearchParams;
export const parseURL = notImplemented('whatwg-url.parseURL');
export const basicURLParse = notImplemented('whatwg-url.basicURLParse');
export const serializeURL = notImplemented('whatwg-url.serializeURL');
export const serializeHost = notImplemented('whatwg-url.serializeHost');
export const serializeInteger = notImplemented('whatwg-url.serializeInteger');
export const serializeURLOrigin = notImplemented('whatwg-url.serializeURLOrigin');
export const setTheUsername = notImplemented('whatwg-url.setTheUsername');
export const setThePassword = notImplemented('whatwg-url.setThePassword');
export const cannotHaveAUsernamePasswordPort = notImplemented('whatwg-url.cannotHaveAUsernamePasswordPort');
export const percentDecodeBytes = notImplemented('whatwg-url.percentDecodeBytes');
export const percentDecodeString = notImplemented('whatwg-url.percentDecodeString');

// Provide a default export to suppress esbuild [import-is-undefined] warning
const whatwgUrl = {
  URL: globalThis.URL,
  URLSearchParams: globalThis.URLSearchParams,
  parseURL,
  basicURLParse,
  serializeURL,
  serializeHost,
  serializeInteger,
  serializeURLOrigin,
  setTheUsername,
  setThePassword,
  cannotHaveAUsernamePasswordPort,
  percentDecodeBytes,
  percentDecodeString,
};
export default whatwgUrl;
