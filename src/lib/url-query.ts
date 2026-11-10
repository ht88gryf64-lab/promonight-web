// One place a path and its query string are joined (fix/gsc-cleanup-2026-11).
//
// Search Console indexed https://www.getpromonight.com/nba/minnesota-timberwolves?
// as its own URL (209 impressions, Nov 2 to 9). No builder in this repo was
// found emitting the bare "?", so the cause is most likely an outside link,
// and the canonical never carried the query. Every builder that joins a query
// goes through withQuery, which never leaves one, and test:live fails on any
// served href ending in "?".
//
// No middleware redirect: a 308 for "path?" was tried on the preview of
// 2026-11-10 and never fired. Vercel receives "GET /path?" but the request
// the middleware sees has already lost the bare "?" (as does `next start`),
// so the middleware cannot tell "path?" from "path" (ruling 2026-11-10: drop
// the 308 in that case).

/** `path` with `query` appended, and no "?" at all when the query is empty. */
export function withQuery(path: string, query: URLSearchParams | string): string {
  const qs = (typeof query === 'string' ? query : query.toString()).replace(/^\?/, '');
  return qs ? `${path}?${qs}` : path;
}
