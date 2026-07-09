// CFB hub (/cfb) data reader (§9, §14). Rivalry-first. Pulls the real rivalry
// slate from cfbGames + cfbRivalries (the corroborated tags, §8) and the school
// colors from cfbSchools. National rivalries + theme games are a CURATED layer
// (legitimate on a human-curated hub, §9) matched to real colors/dates — no
// fabricated facts (theme dates stay off until the §10 sweep confirms them).
//
// Weekly rail (§14a): the current CFB week's rivalry games (CT-anchored Mon–Sun
// window) — on Monday AM the window advances so last weekend drops and the coming
// weekend shows. This is a pure date-window ISR DISPLAY cutover (no scrape),
// reusing the homepage's America/Chicago "today" anchor. Offseason (no games in
// the window) → falls back to the soonest upcoming rivalry games.

import { db } from '@/lib/firebase';
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

// ── curated national rivalries (§9 curated layer). Colors + date + home wired
//    from real data; name/host/est/blurb are the human-curated editorial. ──
interface NationalCurated { key: string; aId: string; bId: string; name: string; trophy?: string; host: string; est: string; neutral: boolean; blurb: string; fallbackDate: string; }
const NATIONAL_CURATED: NationalCurated[] = [
  { key: 'the-game', aId: 'ohio-state', bId: 'michigan', name: 'The Game', host: 'rotates', est: '1897', neutral: false, blurb: 'The one that decides the Big Ten and, most years, a playoff seed.', fallbackDate: '2026-11-28' },
  { key: 'iron-bowl', aId: 'alabama', bId: 'auburn', name: 'Iron Bowl', host: 'rotates', est: '1893', neutral: false, blurb: 'The state of Alabama stops. Nothing else in the sport feels quite like it.', fallbackDate: '2026-11-28' },
  { key: 'red-river', aId: 'texas', bId: 'oklahoma', name: 'Red River Rivalry', trophy: 'Golden Hat', host: 'Dallas (neutral)', est: '1900', neutral: true, blurb: 'Cotton Bowl, split stadium, State Fair outside. A neutral-site classic.', fallbackDate: '2026-10-10' },
  { key: 'cocktail-party', aId: 'georgia', bId: 'florida', name: 'The Cocktail Party', host: 'Jacksonville', est: '1904', neutral: true, blurb: "World's Largest Outdoor Cocktail Party. Neutral-site, all day, all in.", fallbackDate: '2026-10-31' },
];
// pairings flagged NATIONAL on the weekly rail (school-id pairs, order-independent)
const NATIONAL_PAIRS = new Set(NATIONAL_CURATED.map((n) => [n.aId, n.bId].sort().join('|')));

// ── curated theme games (§9). cfbTraditions is not seeded yet; theme identities
//    are well-known facts, but the specific 2026 game/date stays OFF until the
//    §10 theme sweep confirms it (no fabricated dates). Colors from real data. ──
const THEME_CURATED: { schoolId: string; theme: string }[] = [
  { schoolId: 'penn-state', theme: 'White Out' },
  { schoolId: 'tennessee', theme: 'Checker Neyland' },
  { schoolId: 'lsu', theme: 'Death Valley Night' },
  { schoolId: 'iowa-state', theme: 'Cyclone Out' },
];

export interface HubTeam { id: string; name: string; shortName: string; primaryColor: string | null; secondaryColor: string | null; }
export interface HubRivalryGame {
  id: string; date: string; days: number;
  home: HubTeam; away: HubTeam; neutral: boolean;
  trophy: string | null; rivalryName: string | null; national: boolean;
}
export interface HubNationalBlock extends NationalCurated { home: HubTeam; away: HubTeam; date: string; }
export interface HubThemeGame { school: HubTeam; theme: string; }
export interface CfbHubData {
  weekly: { label: 'this-week' | 'next-up'; week: number | null; games: HubRivalryGame[] };
  national: HubNationalBlock[];
  theme: HubThemeGame[];
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

  // National blocks: curated selection, real colors + date + home resolution.
  const gameByPair = new Map<string, HubRivalryGame>();
  for (const g of games) gameByPair.set([g.home.id, g.away.id].sort().join('|'), g);
  const national: HubNationalBlock[] = NATIONAL_CURATED.map((n) => {
    const g = gameByPair.get([n.aId, n.bId].sort().join('|'));
    let home: HubTeam, away: HubTeam, date: string;
    if (g) {
      date = g.date;
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
      date = n.fallbackDate;
    }
    return { ...n, home, away, date };
  });

  // Theme games: curated identities, real colors, no date (unconfirmed).
  const theme: HubThemeGame[] = THEME_CURATED.map((t) => {
    const s = schoolById.get(t.schoolId);
    return { school: s ? toHubTeam(s) : blankTeam(t.schoolId), theme: t.theme };
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

  return { weekly, national, theme, browse, totalTeams: schoolsSnap.size };
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
