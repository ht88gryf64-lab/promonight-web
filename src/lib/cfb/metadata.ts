// CFB metadata (decision record §12 + §13; re-optimized on Ahrefs data, Jul 2026).
// Templated. Formerly TIER-DERIVED on editorialStatus; the destination tier was
// retired 2026-08-25 because nothing loads the blocks it promised (data.ts:311).
// (Original note: reads editorialStatus, so a school's description auto-
// enriches on graduation — no hand edit). Every title is "[School Mascot]
// Football Schedule 2026": "[school] football schedule 2026" is the head term
// with real volume (Ohio State 10k, Alabama 8.3k, Notre Dame 7.8k). The rivalry
// is named in the DESCRIPTION ONLY (2026-10-29): a token-led title doubled
// fourteen schools' names and lowercased one. Descriptions NAME THE RIVAL SCHOOL
// (where the rivalry volume actually is — "ohio state michigan rivalry" 900/mo, not
// the generic "rivalry games" 10/mo) and carry "[stadium] parking" (a KD-1 logistics
// term). Within engine limits (rendered title ≤60, description ≤155). OG uses the
// house /og-image.png so no CFB page ships a blanked image.

import { OG_IMAGE_ALT } from '@/lib/og';
import type { Metadata } from 'next';
import type { CfbSchoolPage } from '@/lib/cfb/data';
import type { MatchupPage } from '@/lib/cfb/matchups';
import { buildMatchupDescription, prettySchoolId } from '@/lib/cfb/matchup-description';
import { venueLocalKickoff } from '@/lib/cfb/kickoff';

// The root layout title template appends ' | PromoNight' (13 chars) to every
// page title. The house standard keeps the RENDERED <title> (field + brand) ≤60
// (pro pages verified 44–58). So the FIELD budget must leave room for the brand.
const BRAND_SUFFIX = ' | PromoNight';
const TITLE_MAX = 60 - BRAND_SUFFIX.length; // 47 → rendered ≤60
const DESC_MAX = 155; // hard cap (Google truncates ~155); every school verified ≤155
const YEAR = 2026;
const BASE = 'https://www.getpromonight.com';
const OG_IMAGE = { url: '/og-image.png', width: 1200, height: 630, alt: OG_IMAGE_ALT };

// §13 rivalry traffic priority. `name` = the full trophy/rivalry name the
// description carries ("The Game vs Michigan"). Higher rank = higher traffic
// potential — the best-ranked of a school's rivalry games is featured. The
// title never carries it (see buildCfbTeamMetadata).
interface Marquee { re: RegExp; name: string; rank: number }
const MARQUEE: Marquee[] = [
  { re: /\bthe game\b/i, name: 'The Game', rank: 100 },
  { re: /red river/i, name: 'the Red River Rivalry', rank: 95 },
  { re: /cocktail party|world'?s largest/i, name: 'the Cocktail Party', rank: 90 },
  { re: /iron bowl/i, name: 'the Iron Bowl', rank: 85 },
  { re: /third saturday/i, name: 'the Third Saturday in October', rank: 80 },
  { re: /egg bowl/i, name: 'the Egg Bowl', rank: 78 },
  { re: /apple cup/i, name: 'the Apple Cup', rank: 76 },
  { re: /bedlam/i, name: 'Bedlam', rank: 74 },
  // MUST require "axe" — "Paul Bunyan's Axe" is Minnesota–Wisconsin; the bare
  // "Paul Bunyan Trophy" is MSU–Michigan, a DIFFERENT rivalry (§5 collision trap).
  { re: /paul bunyan'?s axe/i, name: "Paul Bunyan's Axe", rank: 72 },
  // MSU–Michigan Paul Bunyan Trophy — negative lookahead keeps it off the Axe.
  { re: /paul bunyan(?!'?s axe)/i, name: 'the Paul Bunyan Trophy', rank: 50 },
  { re: /holy war/i, name: 'the Holy War', rank: 70 },
  { re: /backyard brawl/i, name: 'the Backyard Brawl', rank: 68 },
  { re: /palmetto bowl/i, name: 'the Palmetto Bowl', rank: 66 },
  { re: /iron skillet/i, name: 'the Battle for the Iron Skillet', rank: 64 },
  { re: /border war/i, name: 'the Border War', rank: 62 },
  { re: /territorial cup/i, name: 'the Territorial Cup', rank: 60 },
  { re: /clean.*hate/i, name: 'Clean, Old-Fashioned Hate', rank: 58 },
  { re: /floyd of rosedale/i, name: 'Floyd of Rosedale', rank: 45 },
  { re: /little brown jug/i, name: 'the Little Brown Jug', rank: 45 },
  { re: /old oaken bucket/i, name: 'the Old Oaken Bucket', rank: 44 },
  { re: /keg of nails/i, name: 'the Keg of Nails', rank: 40 },
];

// `rival` = the featured rivalry's OPPONENT school (resolved, display-name form).
// It is what the description leads with ("The Game vs Michigan") — the §13 volume
// term names BOTH schools. Null only when a school has no 2026 rivalry game.
// `name` is null for source 'rivalry': the game is tagged as a rivalry but
// carries no trophy, and its stored label is a bare "School–School" pair, which
// is not a name anyone searches for. The description then says "the {rival}
// rivalry" rather than echoing the pair.
export interface FeaturedRivalry { name: string | null; source: 'marquee' | 'trophy' | 'rivalry' | 'none'; rival: string | null }

/** A stored rivalry label that is just the two schools joined by a dash
 *  ("Maryland–Rutgers", "Army–Navy Game"). Detected by the dash plus either
 *  school's name, so a trophy with a dashed personal name ("Jefferson–Eppes
 *  Trophy") still counts as a trophy. */
function isPairLabel(label: string, school: string, rival: string): boolean {
  if (!/[–-]/.test(label)) return false;
  const l = label.toLowerCase();
  return l.includes(school.toLowerCase()) || l.includes(rival.toLowerCase());
}

/** Select the featured rivalry from a school's 2026 rivalry games (§13 priority:
 *  best marquee, else the most recognizable trophy, else the rivalry with no
 *  name, else none). Tracks the winning tag so the RIVAL SCHOOL rides along
 *  (the description names it). */
export function selectFeaturedRivalry(data: CfbSchoolPage): FeaturedRivalry {
  const school = data.school.name;
  const tags = data.games
    .filter((g) => g.rivalry)
    .map((g) => ({ trophy: g.rivalry!.trophy, name: g.rivalry!.name, rival: g.opponentName }));
  if (tags.length === 0) return { name: null, source: 'none', rival: null };
  // best marquee across all this school's rivalry tags — track the winning tag so we
  // can surface the rival (opponentName is already resolved: nameById || prettifySlug).
  let best: Marquee | null = null;
  let bestTag: (typeof tags)[number] | null = null;
  for (const t of tags) {
    const hay = `${t.trophy ?? ''} ${t.name}`;
    for (const m of MARQUEE) if (m.re.test(hay) && (!best || m.rank > best.rank)) { best = m; bestTag = t; }
  }
  if (best && bestTag) return { name: best.name, source: 'marquee', rival: bestTag.rival };
  // No marquee: the first tag whose trophy is a real name, not a pair label.
  // Formerly `trophy ?? name`, which let a bare "Maryland–Rutgers" through as
  // the featured name and, when it led the title, doubled the school's own
  // name ("Maryland Maryland–Rutgers 2026").
  const trophyTag = tags.find((t) => t.trophy && !isPairLabel(t.trophy, school, t.rival));
  if (trophyTag) return { name: trophyTag.trophy!, source: 'trophy', rival: trophyTag.rival };
  return { name: null, source: 'rivalry', rival: tags[0].rival };
}

function firstFit(cands: string[], max: number): string {
  for (const c of cands) if (c.length <= max) return c;
  // all too long → hard-trim the last candidate at a word boundary
  const s = cands[cands.length - 1];
  const slice = s.slice(0, max);
  const sp = slice.lastIndexOf(' ');
  return (sp > 0 ? slice.slice(0, sp) : slice).trimEnd();
}

export function buildCfbTeamMetadata(data: CfbSchoolPage): Metadata {
  const s = data.school;
  const venue = data.venue;
  const fullName = `${s.name} ${s.mascot}`.trim();
  const feat = selectFeaturedRivalry(data);
  const hasRivalry = feat.source !== 'none';
  const stadium = venue?.name ?? null;
  const rival = feat.rival;

  // ── TITLE (field ≤47 → rendered ≤60 after the ' | PromoNight' template).
  //    "[School Mascot] Football Schedule 2026", the same name the description
  //    leads with, plus "& Gameday" when it fits. The rivalry is NOT in the
  //    title: the token-led shape that replaced this on 2026-08 doubled a
  //    school's own name wherever the fallback token was a bare pair label
  //    ("Army Army–Navy Game 2026", fourteen pages on 2026-10-29) and put a
  //    lowercase article in a title ("Minnesota the Axe 2026"). The featured
  //    rivalry now lives in the description only.
  //    Seven schools' name plus mascot overrun the field with the year attached
  //    (Coastal Carolina Chanticleers, Georgia Tech Yellow Jackets, Mississippi
  //    State Bulldogs, Northern Illinois Huskies, Notre Dame Fighting Irish,
  //    Wake Forest Demon Deacons, West Virginia Mountaineers). Those take the
  //    school name alone, same two shapes, rather than letting firstFit trim
  //    the year off the end. ──
  const titleCands = [
    `${fullName} Football Schedule ${YEAR} & Gameday`,
    `${fullName} Football Schedule ${YEAR}`,
    `${s.name} Football Schedule ${YEAR} & Gameday`,
    `${s.name} Football Schedule ${YEAR}`,
  ];
  const title = firstFit(titleCands, TITLE_MAX);

  // ── DESCRIPTION (≤155), TIER-DERIVED, and NAMES THE RIVAL SCHOOL (that is where the
  //    volume is — "ohio state michigan rivalry" 900/mo, not the generic "rivalry
  //    games" 10/mo). Carries "[stadium] parking" (a KD-1 logistics term). A generic
  //    "SchoolA–SchoolB" rivalry label collapses to "the {rival} rivalry" (no redundant
  //    echo, and it still lands the word "rivalry"). Every tier promises only what the
  //    page renders (schedule, the rivalry, venue, tickets/parking/hotels). The former
  //    DESTINATION tier promised "a gameday guide and tailgating" that no read path
  //    loads (src/lib/cfb/data.ts:311 hardcodes the editorial block to nulls); it was
  //    removed 2026-08-25 and returns only with the blocks it describes. ──
  const stadClause = stadium ? `${stadium} parking` : 'parking';
  // The featured rivalry lives HERE and only here. A marquee or trophy name
  // reads "The Game vs Michigan"; a rivalry with no trophy (source 'rivalry',
  // name null) reads "the Rutgers rivalry", never the stored pair label.
  const rivalClause = !hasRivalry || rival == null
    ? ''
    : feat.name
      ? `${feat.name} vs ${rival}, `
      : `the ${rival} rivalry, `;
  const descCands = [
        `${fullName} ${YEAR} football schedule, ${rivalClause}plus tickets, ${stadClause} and hotels for every home game.`,
        `${fullName} ${YEAR} football schedule, ${rivalClause}plus tickets, ${stadClause} and hotels.`,
        `${s.name} ${YEAR} football schedule, ${rivalClause}plus tickets, ${stadClause} and hotels.`,
        `${s.name} ${YEAR} football schedule, ${rivalClause}plus tickets, parking and hotels.`,
        `${s.name} ${YEAR} football schedule, plus tickets, ${stadClause} and hotels for every home game.`,
        `${s.name} ${YEAR} football schedule, plus tickets, parking and hotels.`,
      ];
  const description = firstFit(descCands, DESC_MAX);

  const socialTitle = `${title} | PromoNight`;
  const url = `${BASE}/cfb/${s.id}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title: socialTitle, description, siteName: 'PromoNight', url, type: 'website', images: [OG_IMAGE] },
    twitter: { card: 'summary_large_image', site: '@promo_night_app', creator: '@promo_night_app', title: socialTitle, description, images: [OG_IMAGE.url] },
  };
}

// ── HUB (/cfb) metadata (§13: target "college football rivalries" KD 10, NOT the
//    unwinnable schedule head terms). ──
export function buildCfbHubMetadata(): Metadata {
  // Lead with the exact §13 winnable phrase "college football rivalries"; ≤47 so
  // the rendered <title> (+ ' | PromoNight') stays ≤60. Avoids the schedule head term.
  const title = 'College Football Rivalries & Gameday 2026'; // 41 field → 54 rendered
  // Em-dash-free (house rule: avoid em dashes in user-facing copy); colon + commas.
  // No team count: this is a static module-level export, so a numeric claim
  // cannot derive from the schools collection and drifts the moment the corpus
  // grows (it read "all 86 teams" until the washington-state seed made it 87).
  // No "theme nights": the college corpus carries schedules, venues and
  // rivalries. cfbTraditions has two docs that nothing reads, which is not
  // backing for a claim in the head of the hub.
  const description =
    'College football rivalries and trophy games for 2026: The Game, Iron Bowl, Red River, plus schedules, stadiums and gameday plans for every team.'; // 141 <= 155
  const socialTitle = `${title} | PromoNight`;
  const url = `${BASE}/cfb`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title: socialTitle, description, siteName: 'PromoNight', url, type: 'website', images: [OG_IMAGE] },
    twitter: { card: 'summary_large_image', site: '@promo_night_app', creator: '@promo_night_app', title: socialTitle, description, images: [OG_IMAGE.url] },
  };
}

// ── RIVALRY MATCHUP pages (/cfb/rivalries/[slug]) and their index. ──
//
// These shipped with title only, which left all 33 URLs with NO canonical, an
// og:url pointing at the site root, and the root layout's description, which
// names six pro leagues and no college football. The canonical is the load
// bearing one: an apex/www mismatch is the documented root cause of the May 2026
// Bing deindex, and these were the newest pages on the site.
//
// Both builders emit the FULL openGraph object rather than just a url. Next
// shallow-merges metadata, so a page that sets `openGraph: { url }` REPLACES the
// layout's openGraph wholesale and silently drops og:title and og:image.

/** Kickoff exactly as the page renders it, or null when it is not announced OR
 *  not verified. The verify gate matches data.ts kickoffDisplay: a stored time
 *  on a verified:false game (a flagged date-error, or a parser time the verify
 *  pass has not confirmed) never reaches the description, the lede, the fact
 *  card or the SportsEvent. Exported so every surface builds the SAME string
 *  through this ONE gate (the fact card consumes it too). */
export function renderedKickoff(game: MatchupPage['game'], venueZone: string | null = null): string | null {
  if (!game || game.verified !== true || game.kickoff?.tbd || !game.kickoff?.time) return null;
  if (/tbd/i.test(game.kickoff.time)) return null;
  // With the venue's zone known, render the corroborated instant venue-local
  // (src/lib/cfb/kickoff.ts): the stored label is whichever school parsed the
  // row. Without it, the stored string as-is, the pre-existing contract.
  if (venueZone) {
    const r = venueLocalKickoff(game, venueZone);
    return r.verified ? r.display : null;
  }
  const tz = game.kickoff.tz && game.kickoff.tz !== 'TBD' ? ` ${game.kickoff.tz}` : '';
  return `${game.kickoff.time}${tz}`;
}

export function buildCfbMatchupMetadata(data: MatchupPage): Metadata {
  // displayName, never rivalry.name, so title, H1 and description agree.
  const title = `${data.displayName} ${YEAR}`;
  const [a, b] = data.schools;
  const [aId, bId] = data.rivalry.schoolIds;

  const description = buildMatchupDescription({
    displayName: data.displayName,
    // An untracked school still gets a real name from its id, so the pairing
    // never renders as a gap.
    schoolA: a?.name ?? prettySchoolId(aId),
    schoolB: b?.name ?? prettySchoolId(bId),
    date: data.game?.date ?? null,
    kickoff: renderedKickoff(data.game, data.venueZone),
    venueName: data.resolvedVenue?.name ?? null,
    venueCity: data.resolvedVenue?.city ?? null,
  });

  const socialTitle = `${title} | PromoNight`;
  const url = `${BASE}/cfb/rivalries/${data.slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title: socialTitle, description, siteName: 'PromoNight', url, type: 'website', images: [OG_IMAGE] },
    twitter: { card: 'summary_large_image', site: '@promo_night_app', creator: '@promo_night_app', title: socialTitle, description, images: [OG_IMAGE.url] },
  };
}

// Exported so the index JSON-LD (rivalry-jsonld.ts) reuses the exact strings
// the <head> ships — CollectionPage name/description and meta cannot drift.
export const RIVALRY_INDEX_TITLE = 'College Football Rivalries 2026';
// Promises only what the index renders: date, stadium, trip planning. Kickoffs
// live on the matchup pages once announced, so they are named there, not here.
// No count: the registry is curated and a literal would drift.
export const RIVALRY_INDEX_DESCRIPTION =
  'Named college football rivalries in 2026: the date, the stadium and how to plan the trip. Kickoff times appear on each rivalry page once announced.';

export function buildCfbRivalryIndexMetadata(): Metadata {
  // Description unchanged from what the route already shipped; this builder only
  // adds the canonical and the self-referencing og:url it was missing.
  const title = RIVALRY_INDEX_TITLE;
  const description = RIVALRY_INDEX_DESCRIPTION;
  const socialTitle = `${title} | PromoNight`;
  const url = `${BASE}/cfb/rivalries`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title: socialTitle, description, siteName: 'PromoNight', url, type: 'website', images: [OG_IMAGE] },
    twitter: { card: 'summary_large_image', site: '@promo_night_app', creator: '@promo_night_app', title: socialTitle, description, images: [OG_IMAGE.url] },
  };
}
