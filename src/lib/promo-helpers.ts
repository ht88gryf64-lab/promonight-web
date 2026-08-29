import { APP_LEAGUES, type CoverageCounts } from '@/lib/coverage-counts';
import type { Team, Promo, PromoType, Venue, PlayoffPromo } from './types';
import { PROMO_TYPE_LABELS } from './types';

// Stable synthetic promo ID. Firestore promo subdocs do carry "p1"-style ids
// but the data layer (mapPromoDoc) drops them — (team_slug, date, title)
// uniquely identifies a promo in practice and is what we use everywhere
// analytics needs a stable cross-surface key for the same promo.
export function synthPromoId(teamSlug: string, promo: Pick<Promo, 'date' | 'title'>): string {
  return `${teamSlug}:${promo.date}:${promo.title}`;
}

// Tiny deterministic string hash (base36). Only a slug fallback for anchor ids
// when a title has no slug-able characters (emoji-only), never a security key.
function anchorHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

// URL-safe anchor id for deep-linking a promo card to the exact promo on its
// team page (/[sport]/[team]#promo-{id}). Derived from (date, title) — the
// identity dedupePromos already treats as unique per team — so the link SOURCE
// (the /promos/today card) and the link TARGET (the team-page RedesignPromoRow)
// compute the SAME id from the same fields, with no Firestore doc id threaded
// through the data layer. Team is implicit in the URL path, so it is not part of
// the id. Used with the `promo-` prefix at the callsite: id={`promo-${...}`}.
export function promoAnchorId(promo: Pick<Promo, 'date' | 'title'>): string {
  const slug = (promo.title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  const safe = slug || `x${anchorHash(promo.title || '')}`;
  return `${promo.date}-${safe}`;
}

// Returns the display name for a team, avoiding the "Cincinnati FC Cincinnati"
// doubled-city case for MLS clubs whose `name` already includes the city
// (FC Cincinnati, FC Dallas, Atlanta United, etc.). When the city appears as a
// whole word inside the name, the name alone is the brand — return just the
// name. Otherwise, prepend the city as usual ("Kansas City" + "Royals").
export function teamDisplayName(team: Pick<Team, 'city' | 'name'>): string {
  const city = team.city?.trim() ?? '';
  const name = team.name?.trim() ?? '';
  if (!city) return name;
  if (!name) return city;
  const escaped = city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const cityInName = new RegExp(`\\b${escaped}\\b`, 'i').test(name);
  if (cityInName) return name;
  return `${city} ${name}`;
}

const ROUND_LABELS: Record<string, string> = {
  first_round: 'First Round',
  conference_semifinals: 'Conference Semifinals',
  conference_finals: 'Conference Finals',
  nba_finals: 'NBA Finals',
  stanley_cup_final: 'Stanley Cup Final',
};

export function roundLabel(code: string): string {
  return ROUND_LABELS[code] ?? code.replace(/_/g, ' ');
}

// Parses the opponent team name out of a single playoff promo's gameInfo
// string (e.g. "Game 1 vs New York Knicks (Finals)" → "New York Knicks").
// Returns null when there's no parseable "vs" clause. Shared by the /playoffs
// hub TeamCard and the team-page PlayoffSection.
export function extractOpponent(gameInfo: string): string | null {
  const m = gameInfo.match(/\bvs\.?\s+([A-Z][^(,]+?)(?:\s*\(|$)/);
  return m ? m[1].trim().replace(/[.,]$/, '') : null;
}

// Returns an opponent only when all gameInfo matches across the team's playoff
// promos agree. 0 matches or 2+ distinct matches → null (drop opponent clause
// rather than hallucinate one). Today OKC has one distinct match ("Phoenix
// Suns") across 2 of 9 promos, which qualifies as consistent.
export function extractPlayoffOpponent(promos: PlayoffPromo[]): string | null {
  const opponents = new Set<string>();
  for (const p of promos) {
    const m = p.gameInfo.match(/\bvs\.?\s+([A-Z][^(,]+?)(?:\s*\(|$)/);
    if (m) opponents.add(m[1].trim().replace(/[.,]$/, ''));
  }
  return opponents.size === 1 ? [...opponents][0] : null;
}

function formatPlayoffDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

// Collapse promos that share a title (case-insensitive). Keeps first occurrence.
// Used to avoid "Playoff T-shirt on Every Seat, Playoff T-Shirt on Every Seat"
// in FAQ lists where the same promo was written once per game.
function dedupeByTitleCI(promos: PlayoffPromo[]): PlayoffPromo[] {
  const seen = new Set<string>();
  const out: PlayoffPromo[] = [];
  for (const p of promos) {
    const key = (p.title || '').toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

// "Wednesday, April 22 and Saturday, April 25" / "Apr 10, Apr 12, and Apr 14"
function joinDateList(isoDates: string[]): string {
  const readable = Array.from(new Set(isoDates.map(formatPlayoffDate)));
  if (readable.length === 0) return '';
  if (readable.length === 1) return readable[0];
  if (readable.length === 2) return `${readable[0]} and ${readable[1]}`;
  return `${readable.slice(0, -1).join(', ')}, and ${readable[readable.length - 1]}`;
}

export interface PlayoffFAQContext {
  promos: PlayoffPromo[];
  round: string;
  opponent: string | null;
}

export function resolveIcon(title: string, type: PromoType, iconFromData: string): string {
  const t = (title || '').toLowerCase();

  if (/fireworks/.test(t)) return '💥';

  const looksLikeBobblehead = /bobblehead|figurine|figure|statue/.test(t);
  const icon = (iconFromData || '').trim();

  if (!icon || icon === '💥') {
    if (looksLikeBobblehead) return '🎎';
    if (type === 'giveaway') return '🎁';
  }

  if (!icon) {
    if (type === 'theme') return '🎭';
    if (type === 'kids') return '👦';
    if (type === 'food') return '🌭';
    return '🎁';
  }

  return icon;
}

export function dedupePromos<T extends { date: string; title: string }>(
  promos: T[],
  extraKey?: (p: T) => string,
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const p of promos) {
    const key = `${extraKey ? extraKey(p) : ''}::${p.date}::${(p.title || '').trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

// Visibility predicate for a soft-deleted (tombstoned) promo. This is an
// app-code array filter ONLY: absent and false are visible, only true is
// hidden. It is never used as a Firestore inequality, which would drop
// field-absent docs and break the "absent = visible" rule.
export const isVisiblePromo = (p: { tombstoned?: boolean }): boolean => p.tombstoned !== true;

// ── Section 8 out-of-scope discipline, applied at the RENDER layer ───────────
//
// scanner-framework.md section 8: "Specialty ticket packages / experiences —
// things you *buy*, not free dated promos" are real content but NOT promo-
// calendar content. The ingest layer does not currently enforce that, so rows
// whose own description says a purchase is required arrive typed `giveaway`
// and render under a "Giveaways" pill with a HOT flame beside a sentence that
// reads "special ticket package includes your ticket and...". The label and the
// copy in the same row contradict each other, and the label is the half a
// reader trusts.
//
// This predicate is the single source for that judgment. It reads the row's
// OWN description — not a curated list, not the type — so it cannot drift from
// what the page actually says. Deliberately conservative: it matches only
// explicit purchase language, because a false positive relabels a genuine free
// giveaway, which is the worse error of the two.
export const PURCHASE_GATED_RE =
  /ticket package|special(?:ty)? ticket|package purchase|with (?:the )?purchase|purchase of|separate ticket|voucher required|ticket required|must purchase|only available with/i;

/** The bobblehead keyword, matched against the TITLE only. A description match
 *  pulls in theme nights that merely mention a bobblehead, which is how a
 *  "bobblehead giveaways" count came to include events that give away no
 *  bobblehead. */
export const BOBBLEHEAD_RE = /bobblehead/i;

/**
 * THE defensible bobblehead-giveaway population, and the single source for any
 * number this site publishes about bobbleheads.
 *
 * Three conditions, each removing a measured over-count:
 *   1. typed `giveaway`      — a theme night is not a giveaway
 *   2. "bobblehead" in the TITLE — description matches are passing mentions
 *   3. not purchase-gated    — a ticket package you buy is not a giveaway
 *
 * Measured on the 2026 corpus when this was written: the loose
 * title-or-description predicate returned 347, of which ~45 matched on
 * description alone and ~21 were purchase-gated ticket packages. Publishing 347
 * as "bobblehead giveaways" overstated the real figure by roughly a third.
 */
export function strictBobbleheadGiveaways<T extends Pick<Promo, 'type' | 'title' | 'description'>>(
  promos: T[],
): T[] {
  return promos.filter(
    (p) => p.type === 'giveaway' && BOBBLEHEAD_RE.test(p.title ?? '') && !isPurchaseGated(p),
  );
}

/** True when a promo's own copy says you have to buy something to get it. */
export function isPurchaseGated(p: Pick<Promo, 'title' | 'description'>): boolean {
  return PURCHASE_GATED_RE.test(p.description ?? '') || PURCHASE_GATED_RE.test(p.title ?? '');
}

// ── The single definition of "upcoming" ──────────────────────────────────────
//
// THERE IS EXACTLY ONE OF THESE AND IT LIVES HERE. Do not inline a second
// `p.date >= today` anywhere. The bug this replaced existed precisely because
// the promo LIST filtered by date while every COUNT on the same page did not,
// so the hero advertised promos the list correctly reported as gone. Two
// definitions of one idea is how the two halves of a page came to disagree.
//
// The rule these enforce: a count that reaches DOM, schema, or FAQ text is a
// CLAIM, and a claim may only describe promos a visitor can still attend.
// All-time counts stay available, but only behind a label that says archive.
export function todayYmd(): string {
  return new Date().toISOString().split('T')[0];
}

export const isUpcomingPromo = (p: { date: string }, today: string = todayYmd()): boolean =>
  p.date >= today;

// Splits one already-fetched array into the two populations. `upcoming` is
// date-ascending (soonest first) and `past` is date-descending (most recent
// first), which is the order the completed archive renders in.
//
// Both halves are SORTED here rather than inheriting the caller's order. The
// previous version reversed the filtered array, which produced most-recent-first
// only while the input happened to arrive date-ascending from the Firestore
// orderBy. That is an unstated precondition, and an unstated precondition is a
// bug waiting for the first caller who passes an array from anywhere else.
// Sorting removes the error class instead of documenting the trap.
export function splitPromosByDate<T extends { date: string }>(
  promos: T[],
  today: string = todayYmd(),
): { upcoming: T[]; past: T[] } {
  // DATELESS PROMOS BELONG TO NEITHER POPULATION, and this is deliberate.
  // Recurring deals and the date-in-image clubs carry date=null, which the
  // schema types as string. A dateless promo cannot be claimed as upcoming,
  // because there is no date for a visitor to turn up on, and it is not part of
  // a dated archive either. The previous inline filters dropped them from both
  // sides only as a side effect of null comparing false against a date string;
  // excluding them explicitly keeps that behaviour and stops the sort below
  // dereferencing a null.
  const dated = promos.filter((p) => typeof p.date === 'string' && p.date !== '');
  const upcoming = dated.filter((p) => isUpcomingPromo(p, today));
  const past = dated.filter((p) => !isUpcomingPromo(p, today));
  upcoming.sort((a, b) => a.date.localeCompare(b.date));
  past.sort((a, b) => b.date.localeCompare(a.date));
  return { upcoming, past };
}

// The one place category counts are derived. Callers pass the population they
// intend to describe (upcoming for a claim, the full array for a labelled
// archive) so a count can never disagree with the rows beside it.
//
// The isGiveaway cross-count is preserved from the previous inline version: a
// promo flagged isGiveaway counts toward the giveaway tally even when its
// primary type is something else, so a kids-typed first-N-fans gate giveaway
// stays in the kids list AND is counted as the giveaway it is.
export function countPromosByType(promos: Promo[]): Record<PromoType, number> {
  const counts: Record<PromoType, number> = { giveaway: 0, theme: 0, kids: 0, food: 0 };
  for (const p of promos) {
    if (counts[p.type] !== undefined) counts[p.type]++;
    if (p.isGiveaway && p.type !== 'giveaway') counts.giveaway++;
  }
  return counts;
}

export function formatDateReadable(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

export function getPromosByType(promos: Promo[], type: PromoType): Promo[] {
  return promos.filter((p) => p.type === type);
}

export function getTopGiveaway(promos: Promo[]): Promo | null {
  const giveaways = getPromosByType(promos, 'giveaway');
  if (giveaways.length === 0) return null;

  // Prioritize bobbleheads and jerseys as highest-interest
  const priority = giveaways.find(
    (p) =>
      /bobblehead/i.test(p.title) ||
      /bobblehead/i.test(p.description)
  );
  if (priority) return priority;

  const jersey = giveaways.find(
    (p) =>
      /jersey|replica/i.test(p.title) ||
      /jersey|replica/i.test(p.description)
  );
  if (jersey) return jersey;

  // Fall back to highlighted, then first upcoming
  const highlighted = giveaways.find((p) => p.highlight);
  return highlighted || giveaways[0];
}

export interface FAQItem {
  question: string;
  answer: string;
  // Marks a FAQ whose QUESTION names the product rather than the team, so the
  // JSON-LD emitter can drop it from FAQPage structured data while the visible
  // FAQ keeps it. Optional, so the homepage FAQ literals and every other push
  // site below are unaffected.
  //
  // A flag rather than a string test or a slot index, both of which were
  // considered and rejected. A /PromoNight/ test on the question is correct
  // today but silently over-catches a future legitimate brand question and is
  // blind to a promotional question phrased without the word. An index is worse
  // still: this slot lands at index 5 on a zero-promo page and index 9 on a
  // populated one, because the four data-gated slots above it are skipped, so
  // an index rule tuned on an NFL page would delete a venue FAQ on an MLB page.
  // Setting the flag at the push site keeps the intent next to the copy it
  // describes and survives arbitrary rewording.
  brandPromo?: true;
}

// The gate-time answer, from the venue record or not at all.
//
// What stood here was a switch on league returning a hardcoded cadence ("90
// minutes before first pitch", "about two hours before kickoff") built from the
// venue and team names, and its call site was commented "always shown". It never
// read venue.gatesOpen. So on all 169 team pages this answered a question about
// a specific building with a number nobody had checked against that building,
// and on the 84 pages where a real stored time existed it published the invented
// one instead. It ships inside FAQPage structured data, which makes it a
// machine-readable claim rather than loose prose.
//
// A league cadence is not a fact about a stadium. If the record does not carry
// the time, the honest page does not raise the question.
function gateTimesAnswer(gatesOpen: string | undefined): string | null {
  const stored = gatesOpen?.trim();
  return stored ? stored : null;
}

/** The slice of CoverageCounts the team FAQs state. */
export type TeamFaqCoverage = Pick<CoverageCounts, 'teamCount' | 'leagueList' | 'appLeagueList'>;

export function generateTeamFAQs(
  team: Team,
  // UPCOMING promos only, and the counts derived from them. These answers ship
  // inside FAQPage structured data, so every number and every named promo here
  // is a claim to a crawler. Passing the all-time array would restate a
  // finished season in the present tense, which is what this parameter naming
  // exists to prevent. Split with splitPromosByDate and count with
  // countPromosByType; do not filter at the call site.
  upcomingPromos: Promo[],
  venue: Venue | null,
  upcomingCounts: Record<PromoType, number>,
  // Sitewide coverage facts (team count, league list, the app's league list),
  // derived by the caller from getCoverageCounts(). Required rather than
  // optional on purpose: these answers ship inside FAQPage structured data on
  // every team page, and a defaulted count or a typed league list would go
  // stale silently, which is the exact failure this parameter exists to end.
  coverage: TeamFaqCoverage,
  playoff?: PlayoffFAQContext,
): FAQItem[] {
  // Hardcoded 2026 season year, NOT getCurrentYear(): the page title and meta
  // description already hardcode 2026, and an auto-rolling getFullYear() would
  // flip every FAQ "{year} season" string to the next year at midnight on Jan 1,
  // before that season's promo data exists. Keep these FAQs consistent with the
  // title; bump deliberately when 2027 content is ready.
  const year = 2026;
  const fullName = teamDisplayName(team);
  const venueName = venue?.name || 'their home stadium';
  const faqs: FAQItem[] = [];

  // 1. Remaining promo count. Gated on UPCOMING, so a team whose season has
  // finished emits no count answer at all rather than restating a closed
  // season as if it were still ahead.
  if (upcomingPromos.length > 0) {
    const parts: string[] = [];
    if (upcomingCounts.giveaway > 0)
      parts.push(`${upcomingCounts.giveaway} giveaway night${upcomingCounts.giveaway !== 1 ? 's' : ''}`);
    if (upcomingCounts.theme > 0)
      parts.push(`${upcomingCounts.theme} theme night${upcomingCounts.theme !== 1 ? 's' : ''}`);
    if (upcomingCounts.food > 0)
      parts.push(`${upcomingCounts.food} food deal event${upcomingCounts.food !== 1 ? 's' : ''}`);
    if (upcomingCounts.kids > 0)
      parts.push(`${upcomingCounts.kids} kids/family event${upcomingCounts.kids !== 1 ? 's' : ''}`);

    faqs.push({
      question: `How many promotional nights do the ${team.name} have in ${year}?`,
      answer: `The ${fullName} have ${upcomingPromos.length} promotional events coming up in the ${year} season, including ${parts.join(', ')}. These events take place at ${venueName}${venue?.address ? ` in ${venue.address.split(',').slice(-2, -1)[0]?.trim() || venue.address}` : ''}.`,
    });
  }

  // 2. Best giveaway. Gated on UPCOMING giveaways and selected from the
  // upcoming array, so "most anticipated" can never name an event that has
  // already happened.
  if (upcomingCounts.giveaway > 0) {
    const top = getTopGiveaway(upcomingPromos);
    if (top) {
      faqs.push({
        question: `What is the best ${team.name} giveaway night in ${year}?`,
        answer: `The most anticipated ${team.name} giveaway in ${year} is ${top.title} on ${formatDateReadable(top.date)}${top.opponent ? ` against the ${top.opponent}` : ''}. ${top.description || `${PROMO_TYPE_LABELS.giveaway} nights typically go to the first fans through the gates, so arrive early when gates open.`}`,
      });
    }
  }

  // 3. Food deals (skip if none upcoming)
  if (upcomingCounts.food > 0) {
    const foodPromos = getPromosByType(upcomingPromos, 'food');
    const foodList = foodPromos
      .slice(0, 3)
      .map((p) => p.title)
      .join(', ');

    faqs.push({
      question: `Does ${venueName} have food deals on game days?`,
      answer: `Yes. ${venueName} offers food deal promotions during ${fullName} games. Scheduled food deals include ${foodList}${foodPromos.length > 3 ? `, and ${foodPromos.length - 3} more` : ''}. Check the PromoNight app for specific dates and details for each food promotion.`,
    });
  }

  // 4. Kids events (skip if none upcoming). The answer says "Upcoming family
  // events include", so the list behind it must be upcoming for the sentence
  // to be true.
  if (upcomingCounts.kids > 0) {
    const kidsPromos = getPromosByType(upcomingPromos, 'kids');
    const kidsList = kidsPromos
      .slice(0, 3)
      .map((p) => `${p.title} (${formatDateReadable(p.date)})`)
      .join(', ');

    faqs.push({
      question: `When are ${team.name} kids and family events in ${year}?`,
      answer: `The ${fullName} have ${upcomingCounts.kids} kids and family event${upcomingCounts.kids !== 1 ? 's' : ''} still to come in ${year}. Upcoming family events include ${kidsList}${kidsPromos.length > 3 ? `, and ${kidsPromos.length - 3} more throughout the season` : ''}. These events are designed for young fans and families attending games at ${venueName}.`,
    });
  }

  // 5. How to track (always shown). The app covers APP_LEAGUES only, so the
  // answer names the app on those pages and the weekly email everywhere else:
  // this ships as FAQPage schema, and it used to promise WNBA and NFL fans an
  // app that does not carry their league.
  const inApp = (APP_LEAGUES as readonly string[]).includes(team.league);
  faqs.push({
    question: `How can I track ${fullName} promotional events?`,
    answer: inApp
      ? `PromoNight tracks giveaways, theme nights, food deals and promotions for the ${fullName} and ${coverage.teamCount - 1} other teams across ${coverage.leagueList}, free on this site. The free PromoNight app carries the same ${fullName} calendar on iOS and Android, and PromoNight Pro adds a reminder on the morning of each promo day.`
      : `PromoNight tracks giveaways, theme nights, food deals and promotions for the ${fullName} and ${coverage.teamCount - 1} other teams across ${coverage.leagueList}, free on this site. Star the ${fullName} here to get one weekly email with what is coming up. The PromoNight app covers ${coverage.appLeagueList} and does not carry ${team.league} yet.`,
  });

  // 5b. Travel — gate times. Gated on the stored value: no record, no question.
  const gateAnswer = gateTimesAnswer(venue?.gatesOpen);
  if (gateAnswer) {
    faqs.push({
      question: `What time do gates open at ${venueName}?`,
      answer: gateAnswer,
    });
  }

  // 5c. Travel — directions / parking (always shown)
  {
    const city = venue?.address?.split(',').slice(-3, -2)[0]?.trim() || team.city;
    const addressClause = venue?.address ? `${venueName} is located at ${venue.address}.` : `${venueName} is in ${city}.`;
    faqs.push({
      question: `How do I get to ${venueName}?`,
      answer: `${addressClause} Parking is available on-site on game days, and many fans reserve guaranteed spots in advance through SpotHero to avoid lot-closure surprises. Check the official ${team.name} site for public transit options. Most major-league venues are served by bus or rail routes on game day.`,
    });
  }

  // 5d. Travel — hotels (always shown)
  faqs.push({
    question: `Where should I stay near ${venueName}?`,
    answer: `Several hotels sit within walking distance of ${venueName}, and more are a short rideshare away. For a ${fullName} game weekend, searching Expedia for hotels near ${venueName} surfaces the best rates for your specific date. Prices jump on marquee dates like giveaway nights and playoff games, so booking early helps.`,
  });

  // 5e. App — promo-day reminders (always shown, distinct from #5's general pitch).
  // Reminders are a PromoNight Pro feature: the app schedules a local
  // notification on the device for the morning of the promo date. Nothing is
  // sent from a server, so this answer must not describe a push.
  faqs.push({
    question: `Can I get notifications for ${team.name} promos?`,
    answer: inApp
      ? `Yes, with PromoNight Pro. The app sends a notification on the morning of every ${team.name} promo game, covering bobblehead giveaways, theme nights, food deals, and kids events. Downloading the app and browsing every promo is free. You can follow just the ${team.name} or multiple teams across ${coverage.appLeagueList}.`
      : `Not on your phone yet. Promo-day reminders come from the PromoNight app, which covers ${coverage.appLeagueList} and does not carry ${team.league}. Star the ${team.name} on this site instead to get one weekly email with every giveaway, theme night, and food deal coming up.`,
  });

  // 5f. App — away games (always shown)
  // brandPromo: the QUESTION names the product, not the team. Google receives
  // this as a declared FAQ on a team page, so it is filtered out of the
  // FAQPage payload in json-ld.tsx while staying in the visible FAQ. If a
  // future slot is added whose question is about PromoNight rather than about
  // the team, flag it here too.
  faqs.push({
    brandPromo: true,
    question: `Does PromoNight work for away games?`,
    answer: `PromoNight tracks home-game promotions for ${coverage.teamCount} teams across ${coverage.leagueList}. If you're traveling to see the ${team.name} play on the road, browse the home team's calendar on this site for the promotions we have on record at their venue during your trip.`,
  });

  // 5g. Data authority: provenance plus derived count (only when there's
  // enough data to claim authority). No timestamp: the old render-time
  // "Last updated" stamp was known-issues entry 21 class (synthetic
  // freshness) and no stored per-team stamp covers NBA/NHL, so the answer
  // states provenance and the one cadence that is true on every page.
  if (upcomingPromos.length >= 10) {
    faqs.push({
      question: `How often are ${team.name} promo schedules updated?`,
      answer: `${team.name} promo data comes from official team announcements and is reviewed before it appears here. The current schedule reflects ${upcomingPromos.length} scheduled events. MLB, WNBA, and MLS schedules are rechecked weekly in season.`,
    });
  }

  // 6. Playoff-specific questions (appended only when team is in the active playoff bracket)
  if (playoff && playoff.promos.length > 0) {
    const roundName = roundLabel(playoff.round);
    const opponentClause = playoff.opponent ? ` against the ${playoff.opponent}` : '';

    // "What playoff giveaways are the Team handing out..."
    const playoffGiveaways = playoff.promos.filter((p) => p.type === 'giveaway');
    if (playoffGiveaways.length > 0) {
      const uniqueGiveaways = dedupeByTitleCI(playoffGiveaways);
      const giveawayTitles = uniqueGiveaways.slice(0, 4).map((p) => p.title).join(', ');
      const more = uniqueGiveaways.length > 4 ? `, and ${uniqueGiveaways.length - 4} more` : '';
      // ":" when the list is the full set; "including" when we deduped titles
      // that repeat across games (count > unique titles).
      const connector =
        uniqueGiveaways.length === playoffGiveaways.length ? ': ' : ', including ';
      faqs.push({
        question: `What playoff giveaways are the ${team.name} handing out in ${roundName}?`,
        answer: `The ${fullName} have ${playoffGiveaways.length} scheduled playoff giveaway${playoffGiveaways.length !== 1 ? 's' : ''} during ${roundName}${opponentClause}${connector}${giveawayTitles}${more}. Giveaways are typically handed out to the first fans through the gates at ${venueName}, so arrive before puck drop or tipoff.`,
      });
    } else {
      // Generic fallback when no giveaway-typed playoff promos
      const uniquePromos = dedupeByTitleCI(playoff.promos);
      if (uniquePromos.length === 1 && playoff.promos.length > 1) {
        // Same title repeated across games — collapse to count + dates.
        // Venue is intentionally not appended here: it's already established
        // in the generic FAQ #1 and many such titles already embed the venue
        // name (e.g. "Pregame Party at Grand Casino Arena"), so a trailing
        // "at {venue}" would read as duplicate.
        const title = uniquePromos[0].title;
        const isoDates = playoff.promos
          .filter((p) => p.date)
          .map((p) => p.date as string);
        const dateClause = isoDates.length > 0 ? ` on ${joinDateList(isoDates)}` : '';
        faqs.push({
          question: `What playoff promotions do the ${team.name} have in ${roundName}?`,
          answer: `The ${fullName} have ${playoff.promos.length} scheduled playoff events during ${roundName}${opponentClause}: ${title}${dateClause}.`,
        });
      } else {
        const firstFew = uniquePromos.slice(0, 3).map((p) => p.title).join(', ');
        const connector =
          uniquePromos.length === playoff.promos.length ? ': ' : ', including ';
        faqs.push({
          question: `What playoff promotions do the ${team.name} have in ${roundName}?`,
          answer: `The ${fullName} have ${playoff.promos.length} scheduled playoff promotion${playoff.promos.length !== 1 ? 's' : ''} during ${roundName}${opponentClause}${connector}${firstFew}. See the full list on their team page for dates and details.`,
        });
      }
    }

    // "When are the Team home playoff games?"
    const datedPromos = playoff.promos.filter((p) => p.date);
    if (datedPromos.length > 0) {
      const gameDates = Array.from(
        new Set(datedPromos.map((p) => formatPlayoffDate(p.date as string))),
      );
      const dateList = gameDates.slice(0, 4).join(', ');
      faqs.push({
        question: `When are the ${team.name} home playoff games in ${roundName}?`,
        answer: `The ${fullName} host playoff home games at ${venueName} on ${dateList}${gameDates.length > 4 ? `, plus ${gameDates.length - 4} more if the series extends` : ''}. Specific start times depend on the league's playoff broadcast schedule. Check the official team site for confirmed times.`,
      });
    }
  }

  return faqs;
}
