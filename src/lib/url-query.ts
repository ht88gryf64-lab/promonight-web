// One place a path and its query string are joined (fix/gsc-cleanup-2026-11).
//
// Search Console indexed https://www.getpromonight.com/nba/minnesota-timberwolves?
// as its own URL (209 impressions, Nov 2 to 9). No builder in this repo was
// found emitting the bare "?", so the cause is most likely an outside link,
// but every builder that joins a query goes through withQuery, which never
// leaves one, and the middleware answers a bare "?" with a 308 to the path
// (bareQueryTarget). The canonical never carried the query.

/** `path` with `query` appended, and no "?" at all when the query is empty. */
export function withQuery(path: string, query: URLSearchParams | string): string {
  const qs = (typeof query === 'string' ? query : query.toString()).replace(/^\?/, '');
  return qs ? `${path}?${qs}` : path;
}

/** The URL to send a request to when its raw URL ends in an empty query
 *  ("/path?"), else null. Reads the raw string: URL.search is '' for both
 *  "/path" and "/path?", so the parsed form cannot tell them apart. */
export function bareQueryTarget(rawUrl: string): string | null {
  const q = rawUrl.indexOf('?');
  if (q === -1 || q !== rawUrl.length - 1) return null;
  return rawUrl.slice(0, -1);
}

const REQUEST_URL = Object.getOwnPropertyDescriptor(Request.prototype, 'url')?.get;

/** The URL a request was made with, as the platform handed it over. A
 *  NextRequest's own `url` is its normalized NextURL, which drops a bare
 *  "?"; the underlying Request keeps the raw string. Falls back to `url`. */
export function rawRequestUrl(request: Request): string {
  try {
    const raw = REQUEST_URL?.call(request);
    if (typeof raw === 'string') return raw;
  } catch {
    // not a platform Request: the public url is all there is
  }
  return request.url;
}
