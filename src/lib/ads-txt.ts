import {
  ADS_TXT_FALLBACK,
  ADS_TXT_REVALIDATE_SECONDS,
  ADS_TXT_SOURCE_URL,
} from './ads-txt-fallback';

export type AdsTxtSource = 'upstream' | 'fallback';

export type AdsTxtResult = {
  body: string;
  source: AdsTxtSource;
  /** Machine-readable why, surfaced on the response so ops can see it. */
  reason: string;
};

/**
 * Is this body something we are willing to publish as our ads.txt?
 *
 * A non-200 is not the only way this fetch fails. A CDN in front of the source
 * can answer 200 with an empty body, a truncated body, or an HTML error page,
 * and any of those served as our ads.txt would deauthorize every demand
 * partner we have. Status alone is not evidence that the content is a file.
 *
 * The test is deliberately about SHAPE, not about specific partners: it must
 * carry at least one line that parses as an ads.txt record, meaning a
 * non-comment line with the domain/id/relationship commas and a DIRECT or
 * RESELLER relationship. That stays true when Raptive rotates their partner
 * list, which is the whole reason we proxy instead of pinning a copy.
 */
export function isUsableAdsTxt(body: string): boolean {
  if (!body) return false;
  const trimmed = body.trim();
  // A real file here is ~4.5KB. This only has to exclude empties and stubs.
  if (trimmed.length < 100) return false;
  return /^[^#\s][^\n]*,[^\n]*,\s*(DIRECT|RESELLER)\b/im.test(trimmed);
}

/**
 * Resolve the ads.txt body, preferring upstream and degrading to the committed
 * snapshot. NEVER throws and never yields an empty body: a stale ads.txt costs
 * us the partners added since the snapshot, an absent one costs us all of them.
 *
 * `fetchImpl` is injected so the failure paths are directly testable. Production
 * passes the platform fetch.
 */
export async function resolveAdsTxt(
  fetchImpl: typeof fetch = fetch,
): Promise<AdsTxtResult> {
  try {
    const res = await fetchImpl(ADS_TXT_SOURCE_URL, {
      // Cached by Next's data cache, so crawler volume does not reach Raptive
      // and a slow upstream cannot slow the response.
      next: { revalidate: ADS_TXT_REVALIDATE_SECONDS },
    } as RequestInit);

    if (!res.ok) {
      return { body: ADS_TXT_FALLBACK, source: 'fallback', reason: `upstream-status-${res.status}` };
    }

    const body = await res.text();
    if (!isUsableAdsTxt(body)) {
      return { body: ADS_TXT_FALLBACK, source: 'fallback', reason: 'upstream-body-unusable' };
    }

    return { body, source: 'upstream', reason: 'upstream-ok' };
  } catch {
    return { body: ADS_TXT_FALLBACK, source: 'fallback', reason: 'upstream-unreachable' };
  }
}
