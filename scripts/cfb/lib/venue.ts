/* eslint-disable no-console */
// Venue resolution (decision record §5) — from the Wikipedia infobox stadium
// HYPERLINK, not a text-frequency guess (which mis-picked Arrowhead for Kansas
// State: it plays a game there, but its HOME is Bill Snyder Family Football
// Stadium). The season/program page infobox's `stadium = [[...]]` field is the
// authoritative home-venue link. Everything here is pipeline-PROPOSED and
// verify-gated: `humanConfirmed=false` until an editor confirms at destination
// time. A wrong stadium books a hotel in the wrong city, so it is never trusted.

const UA = 'cfb-phase2/1.0 (research; mkovalik32@gmail.com)';

async function wikitextSection0(title: string): Promise<string> {
  const u = 'https://en.wikipedia.org/w/api.php?action=parse&format=json&prop=wikitext&section=0&page=' + encodeURIComponent(title.replace(/ /g, '_'));
  try {
    const r = await fetch(u, { headers: { 'User-Agent': UA } });
    if (!r.ok) return '';
    const j: any = await r.json();
    return (j.parse && j.parse.wikitext && j.parse.wikitext['*']) || '';
  } catch { return ''; }
}

/** Pull `| stadium = [[Target|Display]]` (or `stad`/`stadium_name`/`arena`) from
 *  infobox wikitext. Returns the LINK TARGET (the actual stadium page). Captures
 *  the whole field value (NOT stopping at the pipe inside a piped wikilink — that
 *  dropped LSU's `[[Tiger Stadium (Louisiana)|Tiger Stadium]]`). */
function stadiumLinkFromInfobox(wt: string): { target: string; display: string } | null {
  const field = wt.match(/\|\s*(?:stadium(?:_name)?|stad|arena)\s*=\s*([^\n]+)/i);
  if (!field) return null;
  const link = field[1].match(/\[\[\s*([^\]|]+?)\s*(?:\|\s*([^\]]+?)\s*)?\]\]/);
  if (!link) return null;
  return { target: link[1].trim(), display: (link[2] || link[1]).trim() };
}

function firstNumber(s: string | undefined): number | null {
  if (!s) return null;
  const m = s.replace(/,/g, '').match(/\d{3,6}/);
  return m ? parseInt(m[0], 10) : null;
}

// Coordinates: handle BOTH the decimal form {{coord|39.20|-96.59}} and the DMS
// form {{coord|39|12|7|N|96|35|38|W}} (Wikipedia uses DMS for most stadiums).
function coordsFromWikitext(wt: string): { lat: number | null; lng: number | null } {
  const body = (wt.match(/\{\{coord\s*\|([^}]*)\}\}/i) || [])[1];
  if (!body) return { lat: null, lng: null };
  const parts = body.split('|').map((p) => p.trim());
  // DMS: D M S H  D M S H  (hemispheres N/S/E/W present)
  const dms = /^[NSEW]$/i;
  const hIdx = parts.findIndex((p) => dms.test(p));
  if (hIdx >= 1 && hIdx <= 3) {
    const toDec = (arr: string[], hemi: string) => {
      const [d, m, s] = [Number(arr[0] || 0), Number(arr[1] || 0), Number(arr[2] || 0)];
      const dec = d + m / 60 + s / 3600;
      return /[SW]/i.test(hemi) ? -dec : dec;
    };
    const latHemi = parts[hIdx];
    const rest = parts.slice(hIdx + 1);
    const lngHemiIdx = rest.findIndex((p) => dms.test(p));
    if (lngHemiIdx >= 1) {
      const lat = toDec(parts.slice(0, hIdx), latHemi);
      const lng = toDec(rest.slice(0, lngHemiIdx), rest[lngHemiIdx]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5 };
    }
  }
  // Decimal: first two numeric tokens
  const nums = parts.filter((p) => /^-?\d+(\.\d+)?$/.test(p));
  if (nums.length >= 2) return { lat: parseFloat(nums[0]), lng: parseFloat(nums[1]) };
  return { lat: null, lng: null };
}

export interface ProposedVenue {
  proposedStadium: string; // display name
  stadiumWikiTitle: string; // link target (the actual stadium page)
  stadiumWikiUrl: string;
  capacity: number | null;
  city: string | null;
  state: string | null;
  lat: number | null;
  lng: number | null;
  humanConfirmed: false; // verify-gate: never trusted until an editor confirms
  proposedFrom: string;
  source: string;
  resolved: boolean;
  note?: string;
}

export interface VenueTarget {
  id: string;
  name: string;
  nick: string;
  wikiTeamPage: string | null; // 2026 season page (null for the 4 not-yet-created)
}

/** Resolve a school's HOME venue from the infobox hyperlink. Falls back from the
 *  season page to the program page ("<Name> <Nick> football") when the season
 *  page is absent (the 4 timing-stranded G5). Always proposed + verify-gated. */
export async function resolveVenue(school: VenueTarget): Promise<ProposedVenue> {
  const candidates = [
    school.wikiTeamPage || null,
    `${school.name} ${school.nick} football`,
  ].filter(Boolean) as string[];

  let link: { target: string; display: string } | null = null;
  let sourceTitle = '';
  for (const title of candidates) {
    const wt = await wikitextSection0(title);
    const l = stadiumLinkFromInfobox(wt);
    if (l) { link = l; sourceTitle = title; break; }
  }
  if (!link) {
    return {
      proposedStadium: '', stadiumWikiTitle: '', stadiumWikiUrl: '', capacity: null, city: null, state: null,
      lat: null, lng: null, humanConfirmed: false, proposedFrom: 'wiki-infobox-hyperlink', source: candidates[0] || '',
      resolved: false, note: 'no stadium link found in season/program infobox — flag for human',
    };
  }
  const stadiumWikiUrl = 'https://en.wikipedia.org/wiki/' + encodeURIComponent(link.target.replace(/ /g, '_'));

  // Pull capacity / location / coords from the stadium page infobox.
  const swt = await wikitextSection0(link.target);
  const capacity = firstNumber((swt.match(/\|\s*capacity\s*=\s*([^\n|]+)/i) || [])[1]);
  const loc = (swt.match(/\|\s*location\s*=\s*([^\n]+)/i) || [])[1] || '';
  const locClean = loc.replace(/\[\[|\]\]/g, '').replace(/\{\{[^}]*\}\}/g, '').replace(/<[^>]+>/g, '').trim();
  const locParts = locClean.split(',').map((s) => s.trim()).filter(Boolean);
  const city = locParts[0] || null;
  const state = locParts[1] ? locParts[1].replace(/\.$/, '') : null;
  const { lat, lng } = coordsFromWikitext(swt);

  return {
    proposedStadium: link.display,
    stadiumWikiTitle: link.target,
    stadiumWikiUrl,
    capacity, city, state, lat, lng,
    humanConfirmed: false,
    proposedFrom: sourceTitle === school.wikiTeamPage ? 'wiki-season-infobox-hyperlink' : 'wiki-program-infobox-hyperlink',
    source: stadiumWikiUrl,
    resolved: true,
  };
}
