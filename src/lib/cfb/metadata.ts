// CFB metadata (decision record §12 + §13). Templated, TIER-DERIVED (reads
// editorialStatus, so a school's description auto-enriches on graduation — no
// hand edit), rivalry/travel-angled (the winnable wedge; §13), within engine
// limits (title ≤60, description ≤160 — Google's ceilings; Bing follows). OG
// uses the house /og-image.png so no CFB page ships a blanked image.

import type { Metadata } from 'next';
import type { CfbSchoolPage } from '@/lib/cfb/data';

// The root layout title template appends ' | PromoNight' (13 chars) to every
// page title. The house standard keeps the RENDERED <title> (field + brand) ≤60
// (pro pages verified 44–58). So the FIELD budget must leave room for the brand.
const BRAND_SUFFIX = ' | PromoNight';
const TITLE_MAX = 60 - BRAND_SUFFIX.length; // 47 → rendered ≤60
const DESC_MAX = 160;
const YEAR = 2026;
const BASE = 'https://www.getpromonight.com';
const OG_IMAGE = { url: '/og-image.png', width: 1200, height: 630, alt: 'PromoNight — Every giveaway, every team' };

// §13 rivalry traffic priority. `token` = the short form for the (char-tight)
// title; `name` = the full trophy/rivalry name for the description. Higher rank =
// higher traffic potential — the best-ranked of a school's rivalry games is featured.
interface Marquee { re: RegExp; token: string; name: string; rank: number }
const MARQUEE: Marquee[] = [
  { re: /\bthe game\b/i, token: 'The Game', name: 'The Game', rank: 100 },
  { re: /red river/i, token: 'Red River', name: 'the Red River Rivalry', rank: 95 },
  { re: /cocktail party|world'?s largest/i, token: 'Cocktail Party', name: 'the Cocktail Party', rank: 90 },
  { re: /iron bowl/i, token: 'Iron Bowl', name: 'the Iron Bowl', rank: 85 },
  { re: /third saturday/i, token: 'Third Saturday', name: 'the Third Saturday in October', rank: 80 },
  { re: /egg bowl/i, token: 'Egg Bowl', name: 'the Egg Bowl', rank: 78 },
  { re: /apple cup/i, token: 'Apple Cup', name: 'the Apple Cup', rank: 76 },
  { re: /bedlam/i, token: 'Bedlam', name: 'Bedlam', rank: 74 },
  // MUST require "axe" — "Paul Bunyan's Axe" is Minnesota–Wisconsin; the bare
  // "Paul Bunyan Trophy" is MSU–Michigan, a DIFFERENT rivalry (§5 collision trap).
  { re: /paul bunyan'?s axe/i, token: 'the Axe', name: "Paul Bunyan's Axe", rank: 72 },
  // MSU–Michigan Paul Bunyan Trophy — negative lookahead keeps it off the Axe.
  { re: /paul bunyan(?!'?s axe)/i, token: 'Paul Bunyan', name: 'the Paul Bunyan Trophy', rank: 50 },
  { re: /holy war/i, token: 'Holy War', name: 'the Holy War', rank: 70 },
  { re: /backyard brawl/i, token: 'Backyard Brawl', name: 'the Backyard Brawl', rank: 68 },
  { re: /palmetto bowl/i, token: 'Palmetto Bowl', name: 'the Palmetto Bowl', rank: 66 },
  { re: /iron skillet/i, token: 'Iron Skillet', name: 'the Battle for the Iron Skillet', rank: 64 },
  { re: /border war/i, token: 'Border War', name: 'the Border War', rank: 62 },
  { re: /territorial cup/i, token: 'Territorial Cup', name: 'the Territorial Cup', rank: 60 },
  { re: /clean.*hate/i, token: 'the Hate', name: 'Clean, Old-Fashioned Hate', rank: 58 },
  { re: /floyd of rosedale/i, token: 'Floyd of Rosedale', name: 'Floyd of Rosedale', rank: 45 },
  { re: /little brown jug/i, token: 'Little Brown Jug', name: 'the Little Brown Jug', rank: 45 },
  { re: /old oaken bucket/i, token: 'Old Oaken Bucket', name: 'the Old Oaken Bucket', rank: 44 },
  { re: /keg of nails/i, token: 'Keg of Nails', name: 'the Keg of Nails', rank: 40 },
];

export interface FeaturedRivalry { token: string | null; name: string | null; source: 'marquee' | 'trophy' | 'none' }

/** Select the featured rivalry from a school's 2026 rivalry games (§13 priority:
 *  best marquee, else the most recognizable trophy, else none). */
export function selectFeaturedRivalry(data: CfbSchoolPage): FeaturedRivalry {
  const tags = data.games.filter((g) => g.rivalry).map((g) => ({ trophy: g.rivalry!.trophy, name: g.rivalry!.name }));
  if (tags.length === 0) return { token: null, name: null, source: 'none' };
  // best marquee across all this school's rivalry tags
  let best: Marquee | null = null;
  for (const t of tags) {
    const hay = `${t.trophy ?? ''} ${t.name}`;
    for (const m of MARQUEE) if (m.re.test(hay) && (!best || m.rank > best.rank)) best = m;
  }
  if (best) return { token: best.token, name: best.name, source: 'marquee' };
  // no marquee → most recognizable trophy (prefer a tag that carries a trophy name).
  // No length cap: the title fallback chain drops the token when it won't fit, so a
  // short-named school still gets its trophy featured (Toledo → "Battle of I-75 Trophy").
  const withTrophy = tags.find((t) => t.trophy);
  const pick = withTrophy?.trophy ?? tags[0].trophy ?? tags[0].name;
  return { token: pick, name: pick, source: 'trophy' };
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
  const isDestination = data.editorialStatus === 'destination';
  const fullName = `${s.name} ${s.mascot}`.trim();
  const feat = selectFeaturedRivalry(data);
  const hasRivalry = feat.source !== 'none';
  const venueClause = venue ? ` at ${venue.name}` : '';
  const rivalryPhrase = feat.name ? `${feat.name} and rivalry games` : 'rivalry games';

  // ── TITLE (≤60), rivalry-featured with a graceful fallback chain. A school with
  //    NO rivalry games (none tracked in 2026) never claims "Rivalries" (no over-claim). ──
  // Lead with the trophy (the wedge), not "Schedule" (budget-eating, and the
  // schedule head term is unwinnable per §13). Fallback drops to a generic-but-
  // accurate "Rivalries" only when the trophy can't fit the field budget.
  const titleCands = hasRivalry
    ? [
        `${s.name} Football ${YEAR}: ${feat.token} & Gameday`,
        `${s.name} Football ${YEAR}: ${feat.token}`,
        `${s.name} Football ${YEAR}: Rivalries & Gameday`,
        `${s.name} Football ${YEAR}: Rivalries`,
        `${s.name} Football ${YEAR} Schedule`,
      ]
    : [
        `${s.name} Football ${YEAR}: Schedule & Gameday`,
        `${s.name} Football ${YEAR} Schedule`,
      ];
  const title = firstFit(titleCands, TITLE_MAX);

  // ── DESCRIPTION (≤160), TIER-DERIVED. Auto promises only what the page has
  //    (schedule, rivalry games, venue, tickets/parking/hotels). Destination may
  //    promise gameday guide + tailgating — dormant until a school graduates. ──
  const rivClause = hasRivalry ? `, ${rivalryPhrase},` : ',';
  const descCands = isDestination
    ? [
        `${fullName} ${YEAR}: ${rivalryPhrase}, a gameday guide, tailgating, plus tickets, parking and hotels${venueClause}.`,
        `${fullName} ${YEAR}: ${rivalryPhrase}, gameday guide and tailgating, plus tickets, parking and hotels.`,
        `${fullName} ${YEAR}: ${rivalryPhrase}, gameday guide, tickets and travel${venueClause}.`,
        `${s.name} ${YEAR}: ${rivalryPhrase}, gameday guide, tickets and travel.`,
      ]
    : [
        `${fullName} ${YEAR} schedule${rivClause} plus tickets, parking and hotels for every home game${venueClause}.`,
        `${fullName} ${YEAR} schedule${rivClause} plus tickets, parking and hotels for every home game.`,
        `${fullName} ${YEAR} schedule${rivClause} plus tickets, parking and hotels${venueClause}.`,
        `${s.name} ${YEAR} football schedule${rivClause} plus tickets, parking and hotels.`,
        `${s.name} ${YEAR} football schedule, plus gameday tickets, parking and hotels.`,
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
  const description =
    'College football rivalries, trophy games and theme nights for 2026 — The Game, Iron Bowl, Red River — plus schedules and gameday plans for all 86 teams.';
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
