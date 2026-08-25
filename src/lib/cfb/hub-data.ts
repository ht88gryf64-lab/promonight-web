// CFB hub (/cfb) data reader (§9, §14). Rivalry-first. Pulls the real rivalry
// slate from cfbGames + cfbRivalries (the corroborated tags, §8) and the school
// colors from cfbSchools. The national rivalries are a CURATED selection
// (legitimate on a human-curated hub, §9): WHICH four, plus the host descriptor
// and the blurb, are editorial; every fact on the block (date, series start
// year, trophy, colors, home side) is read from Firestore or not rendered.
// Theme games were removed 2026-08-25: cfbTraditions has 2 docs and 0 school
// references, so a theme rail had nothing to derive from. It returns with data.
//
// Weekly rail (§14a): the current CFB week's rivalry games (CT-anchored Mon–Sun
// window) — on Monday AM the window advances so last weekend drops and the coming
// weekend shows. This is a pure date-window ISR DISPLAY cutover (no scrape),
// reusing the homepage's America/Chicago "today" anchor. Offseason (no games in
// the window) → falls back to the soonest upcoming rivalry games.

import { db } from '@/lib/firebase';
import { matchupEntryForSlug } from '@/lib/cfb/matchup-registry';
import { resolveMatchupDisplayName } from '@/lib/cfb/display-name';
import { CFB_COLLECTIONS, type CfbSchool, type CfbGame, type CfbRivalry } from '@/lib/cfb/types';
import { CFB_CONF_BUCKET_ORDER, type CfbConfBucket } from '@/lib/cfb/conferences';

// ── CT-anchored date helpers (same anchor as the homepage; no scrape) ──
function chicagoTodayYMD(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
function dow(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
function plusDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}
function daysBetween(from: string, to: string): number {
  const [ay, am, ad] = from.split('-').map(Number);
  const [by, bm, bd] = to.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

// ── conference bucketing (mockup's 6 buckets) ── order + slugs are single-
// sourced in lib/cfb/conferences.ts (shared with the pro-browser sub-row).
const CONF_BUCKET_ORDER = CFB_CONF_BUCKET_ORDER;
function bucketFor(conf: string): CfbConfBucket {
  const c = (conf || '').toLowerCase();
  if (c.includes('sec')) return 'SEC';
  if (c.includes('big ten') || c.includes('b1g')) return 'Big Ten';
  if (c === 'acc' || c.includes('atlantic coast')) return 'ACC';
  if (c.includes('big 12') || c.includes('big12')) return 'Big 12';
  if (c.includes('independ')) return 'Independents';
  return 'Group of 5'; // AAC, Sun Belt, MWC, MAC, C-USA, Pac-12 remnants
}

// ── curated national rivalries (§9 curated layer). Colors, date, home side,
//    series start year and trophy are all read from Firestore at render time;
//    name, host descriptor and blurb are the human-curated editorial (the
//    blurbs have no backing field yet; see audit/cfb-section-anatomy.md §6).
//    Never a hardcoded year, trophy or date here: the hub and the matchup page
//    it links to must agree, and only one source can guarantee that. ──
interface NationalCurated {
  key: string; aId: string; bId: string; name: string;
  host: string; neutral: boolean; blurb: string;
  /** Registry slug for the matchup page this block links to. The curated `key`
   *  is NOT the slug: it predates the registry and two of them differ. The
   *  registry entry also carries the cfbRivalries doc id the facts come from. */
  matchupSlug: string;
}
const NATIONAL_CURATED: NationalCurated[] = [
  { key: 'the-game', matchupSlug: 'the-game', aId: 'ohio-state', bId: 'michigan', name: 'The Game', host: 'rotates', neutral: false, blurb: 'The one that decides the Big Ten and, most years, a playoff seed.' },
  { key: 'iron-bowl', matchupSlug: 'iron-bowl', aId: 'alabama', bId: 'auburn', name: 'Iron Bowl', host: 'rotates', neutral: false, blurb: 'The state of Alabama stops. Nothing else in the sport feels quite like it.' },
  { key: 'red-river', matchupSlug: 'red-river-rivalry', aId: 'texas', bId: 'oklahoma', name: 'Red River Rivalry', host: 'Dallas (neutral)', neutral: true, blurb: 'Cotton Bowl, split stadium, State Fair outside. A neutral-site classic.' },
  { key: 'cocktail-party', matchupSlug: 'florida-georgia', aId: 'georgia', bId: 'florida', name: 'The Cocktail Party', host: 'Jacksonville', neutral: true, blurb: "World's Largest Outdoor Cocktail Party. Neutral-site, all day, all in." },
];
// pairings flagged NATIONAL on the weekly rail (school-id pairs, order-independent)
const NATIONAL_PAIRS = new Set(NATIONAL_CURATED.map((n) => [n.aId, n.bId].sort().join('|')));

export interface HubTeam { id: string; name: string; shortName: string; primaryColor: string | null; secondaryColor: string | null; }
export interface HubRivalryGame {
  id: string; date: string; days: number;
  home: HubTeam; away: HubTeam; neutral: boolean;
  trophy: string | null; rivalryName: string | null; national: boolean;
}
export interface HubNationalBlock extends NationalCurated {
  home: HubTeam; away: HubTeam;
  /** The pair's 2026 game date from cfbGames, or null when no game doc exists.
   *  Never a fallback literal: a date that is not in the data is not rendered. */
  date: string | null;
  /** cfbRivalries.seriesStartYear for the linked rivalry doc, or null. */
  est: number | null;
  /** cfbRivalries.trophy for the linked rivalry doc, or null. */
  trophy: string | null;
}
export interface CfbHubData {
  weekly: { label: 'this-week' | 'next-up'; week: number | null; games: HubRivalryGame[] };
  national: HubNationalBlock[];
  browse: { bucket: string; teams: HubTeam[] }[];
  totalTeams: number;
}

function toHubTeam(s: CfbSchool): HubTeam {
  return { id: s.id, name: s.name, shortName: s.shortName || s.name, primaryColor: s.primaryColor ?? null, secondaryColor: s.secondaryColor ?? null };
}

export async function getCfbHubData(): Promise<CfbHubData> {
  const [schoolsSnap, gamesSnap, rivalriesSnap] = await Promise.all([
    db.collection(CFB_COLLECTIONS.schools).get(),
    // Fetch all games and filter rivalryId in code — a Firestore `!= null` query
    // drops field-absent docs and needs an index; the full set is small (~670).
    db.collection(CFB_COLLECTIONS.games).get(),
    db.collection(CFB_COLLECTIONS.rivalries).get(),
  ]);

  const schoolById = new Map<string, CfbSchool>();
  for (const d of schoolsSnap.docs) schoolById.set(d.id, d.data() as CfbSchool);
  const rivalryById = new Map<string, CfbRivalry>();
  for (const d of rivalriesSnap.docs) rivalryById.set(d.id, d.data() as CfbRivalry);

  const today = chicagoTodayYMD();

  // Build the rivalry-game list (both schools tracked + a date present).
  const games: HubRivalryGame[] = [];
  for (const d of gamesSnap.docs) {
    const g = d.data() as CfbGame;
    if (!g.date || !g.rivalryId) continue;
    const home = schoolById.get(g.homeSchoolId);
    const away = schoolById.get(g.awaySchoolId);
    if (!home || !away) continue;
    const riv = rivalryById.get(g.rivalryId);
    games.push({
      id: g.id, date: g.date, days: daysBetween(today, g.date),
      home: toHubTeam(home), away: toHubTeam(away), neutral: !!g.neutralSite,
      trophy: riv?.trophy ?? null, rivalryName: riv?.name ?? null,
      national: NATIONAL_PAIRS.has([g.homeSchoolId, g.awaySchoolId].sort().join('|')),
    });
  }
  games.sort((a, b) => a.date.localeCompare(b.date));

  // Weekly rail (§14a): current CFB week (CT Mon–Sun), rolls Monday. Offseason
  // (empty window) → soonest upcoming rivalry games.
  const dToday = dow(today);
  const backToMon = dToday === 0 ? 6 : dToday - 1;
  const weekStart = plusDays(today, -backToMon);
  const weekEnd = plusDays(weekStart, 6);
  const thisWeek = games.filter((g) => g.date >= weekStart && g.date <= weekEnd);
  const upcoming = games.filter((g) => g.date >= today);
  const weekly = thisWeek.length > 0
    ? { label: 'this-week' as const, week: cfbWeekNumber(today), games: thisWeek.slice(0, 12) }
    : { label: 'next-up' as const, week: null, games: upcoming.slice(0, 8) };

  // National blocks: curated selection; colors, date, home side, series start
  // year and trophy all resolved from the same docs the matchup page reads.
  const gameByPair = new Map<string, HubRivalryGame>();
  for (const g of games) gameByPair.set([g.home.id, g.away.id].sort().join('|'), g);
  const national: HubNationalBlock[] = NATIONAL_CURATED.map((curated) => {
    // The registry display name WINS over the curated string, so the block and
    // the page it links to always agree. "The Cocktail Party" becomes
    // "Florida vs Georgia"; the other three have no override and keep theirs.
    const entry = matchupEntryForSlug(curated.matchupSlug);
    const n = { ...curated, name: resolveMatchupDisplayName(entry, curated.name) };
    // The rivalry doc behind the matchup page this block links to. Series start
    // year and trophy come from here and nowhere else, so the block cannot say
    // EST. 1904 while the page one hop away says 1915.
    const riv = entry ? rivalryById.get(entry.rivalryId) : undefined;
    const est = typeof riv?.seriesStartYear === 'number' ? riv.seriesStartYear : null;
    const trophy = riv?.trophy ?? null;
    const g = gameByPair.get([n.aId, n.bId].sort().join('|'));
    let home: HubTeam, away: HubTeam;
    // No game doc for the pair means no date on the block. Never a fallback.
    const date: string | null = g ? g.date : null;
    if (g) {
      if (n.neutral) {
        // neutral → alphabetical (home-left rule has no meaning at a neutral site)
        [home, away] = g.home.name.localeCompare(g.away.name) <= 0 ? [g.home, g.away] : [g.away, g.home];
      } else {
        [home, away] = [g.home, g.away];
      }
    } else {
      const sa = schoolById.get(n.aId), sb = schoolById.get(n.bId);
      home = sa ? toHubTeam(sa) : blankTeam(n.aId);
      away = sb ? toHubTeam(sb) : blankTeam(n.bId);
    }
    return { ...n, home, away, date, est, trophy };
  });

  // Browse: ALL teams grouped into the 6 buckets (every one renders — the page's
  // selector is a CSS filter over the full set, never a conditional fetch).
  const byBucket = new Map<string, HubTeam[]>();
  for (const b of CONF_BUCKET_ORDER) byBucket.set(b, []);
  for (const d of schoolsSnap.docs) {
    const s = d.data() as CfbSchool;
    byBucket.get(bucketFor(s.conferenceBySeason?.['2026'] || ''))!.push(toHubTeam(s));
  }
  const browse = CONF_BUCKET_ORDER.map((b) => ({ bucket: b, teams: byBucket.get(b)!.sort((x, y) => x.name.localeCompare(y.name)) })).filter((b) => b.teams.length > 0);

  return { weekly, national, browse, totalTeams: schoolsSnap.size };
}

function blankTeam(id: string): HubTeam {
  return { id, name: id.replace(/-/g, ' '), shortName: id.replace(/-/g, ' '), primaryColor: null, secondaryColor: null };
}

// CFB week number (Week 1 ≈ the week containing the first Saturday of the season,
// ~late Aug). Best-effort label; null in the offseason path.
function cfbWeekNumber(today: string): number | null {
  const seasonStart = '2026-08-24'; // Monday of Week 1
  const diff = daysBetween(seasonStart, today);
  if (diff < 0) return null;
  return Math.min(15, Math.floor(diff / 7) + 1);
}
