// Outbound UTM tagging for links we control (email, X posts, Reddit, etc.).
// Never mutates existing utm_* params unless the caller passed a new value —
// useful when re-tagging a link that already carries partner tracking.

export type UtmParams = {
  source: string;
  medium: string;
  campaign: string;
  content?: string;
  term?: string;
};

export function buildUtmUrl(baseUrl: string, params: UtmParams): string {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    // Fall back to a relative-URL parse so callers can pass site-relative paths.
    url = new URL(baseUrl, 'https://www.getpromonight.com');
    if (!/^https?:\/\//i.test(baseUrl)) {
      // Strip the synthetic origin — this signals a relative URL.
      const rel = `${url.pathname}${url.search}${url.hash}`;
      return applyUtms(rel, params);
    }
  }
  url.searchParams.set('utm_source', params.source);
  url.searchParams.set('utm_medium', params.medium);
  url.searchParams.set('utm_campaign', params.campaign);
  if (params.content !== undefined) url.searchParams.set('utm_content', params.content);
  if (params.term !== undefined) url.searchParams.set('utm_term', params.term);
  return url.toString();
}

function applyUtms(relative: string, params: UtmParams): string {
  const [pathAndQuery, hash = ''] = relative.split('#');
  const [path, query = ''] = pathAndQuery.split('?');
  const search = new URLSearchParams(query);
  search.set('utm_source', params.source);
  search.set('utm_medium', params.medium);
  search.set('utm_campaign', params.campaign);
  if (params.content !== undefined) search.set('utm_content', params.content);
  if (params.term !== undefined) search.set('utm_term', params.term);
  const qs = search.toString();
  return `${path}${qs ? `?${qs}` : ''}${hash ? `#${hash}` : ''}`;
}
