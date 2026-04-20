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

export function captureUTMs(): UTMFields | null {
  if (typeof window === 'undefined') return null;
  const fresh = readUTMsFromLocation();
  if (!fresh) return getStoredUTMs();
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  } catch {
    // Private mode / storage disabled — silently ignore
  }
  return fresh;
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
