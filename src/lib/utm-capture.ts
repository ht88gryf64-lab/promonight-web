const STORAGE_KEY = 'pn_utm';
const UTM_FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;

export type UTMFields = Partial<Record<(typeof UTM_FIELDS)[number], string>>;

export function readUTMsFromLocation(): UTMFields | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const utms: UTMFields = {};
  let found = false;
  for (const key of UTM_FIELDS) {
    const value = params.get(key);
    if (value) {
      utms[key] = value;
      found = true;
    }
  }
  return found ? utms : null;
}

/** The session's FIRST-TOUCH UTMs (social bridge, 2026-11-05): the first
 *  tagged URL of the browser session is kept for the whole session, and a
 *  later tagged URL (a second Short's link, a bio link) never overwrites it.
 *  Before this the latest tagged URL won. Returns what is stored after the
 *  call, or null when the session carries none. */
export function captureUTMs(): UTMFields | null {
  if (typeof window === 'undefined') return null;
  const stored = getStoredUTMs();
  if (stored) return stored;
  const fresh = readUTMsFromLocation();
  if (!fresh) return null;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  } catch {
    // Private mode / storage disabled — silently ignore
  }
  return fresh;
}

/** The three UTMs the click events carry (promo_link_click, app_download_click,
 *  web_app_cta_click): utm_source, utm_campaign and utm_content, from the
 *  session's first touch; absent keys are left out. */
export type UtmTriplet = { utm_source?: string; utm_campaign?: string; utm_content?: string };

export function utmTriplet(utms: UTMFields | null = getStoredUTMs()): UtmTriplet {
  if (!utms) return {};
  const out: UtmTriplet = {};
  if (utms.utm_source) out.utm_source = utms.utm_source;
  if (utms.utm_campaign) out.utm_campaign = utms.utm_campaign;
  if (utms.utm_content) out.utm_content = utms.utm_content;
  return out;
}

export function getStoredUTMs(): UTMFields | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UTMFields;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function flattenUTMsForEvent(utms: UTMFields | null): Record<string, string> {
  if (!utms) return {};
  const out: Record<string, string> = {};
  for (const key of UTM_FIELDS) {
    const v = utms[key];
    if (v) out[key] = v;
  }
  return out;
}
