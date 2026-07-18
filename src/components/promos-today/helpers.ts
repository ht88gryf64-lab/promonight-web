import type { PromoWithTeam } from '@/lib/types';
import { LEAGUE_HUB_REGISTRY, getLeagueHub } from '@/lib/league-hubs';
import { teamDisplayName } from '@/lib/promo-helpers';

// Shared helpers for the /promos/today "Daily Board". League grouping, the hero
// answer sentence, and per-card copy — all derived from the live promo set so the
// page (and any AI Overview quoting it) reflects the actual promos, never a
// static string.

export interface LeagueGroup {
  league: string; // team.league code, e.g. 'MLB'
  label: string; // short display label
  accent: string; // house-palette hex for the color bar / dot
  hubHref: string | null; // '/mlb' when the hub is live, else null (no broken link)
  promos: PromoWithTeam[];
}

// Section order follows the single-source hub registry; any league present in
// the data but not yet in the registry is appended (alphabetical) rather than
// dropped — the grouping is data-driven, never a hardcoded allowlist that could
// hide a league whose promo lands on "today".
const REGISTRY_ORDER = LEAGUE_HUB_REGISTRY.map((h) => h.league);

function sortWithinLeague(a: PromoWithTeam, b: PromoWithTeam): number {
  const at = a.time || '99:99';
  const bt = b.time || '99:99';
  return at.localeCompare(bt) || a.title.localeCompare(b.title);
}

export function groupPromosByLeague(promos: PromoWithTeam[]): LeagueGroup[] {
  const byLeague = new Map<string, PromoWithTeam[]>();
  for (const p of promos) {
    const list = byLeague.get(p.team.league) ?? [];
    list.push(p);
    byLeague.set(p.team.league, list);
  }
  const ordered = [
    ...REGISTRY_ORDER.filter((lg) => byLeague.has(lg)),
    ...[...byLeague.keys()].filter((lg) => !REGISTRY_ORDER.includes(lg)).sort(),
  ];
  return ordered.map((league) => {
    const hub = getLeagueHub(league);
    const list = byLeague.get(league)!;
    list.sort(sortWithinLeague);
    return {
      league,
      label: hub?.label ?? league,
      accent: hub?.accent ?? '#6f665a',
      hubHref: hub?.live ? hub.href : null,
      promos: list,
    };
  });
}

// "A and B" / "A, B, and C".
function joinList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

// The inverted-pyramid answer sentence for the hero, generated from today's
// promo set. Names the count, the leagues covered, and the first few promos — the
// text Google / AI Overviews pull for the "mlb team promotions today" intent.
// No em dashes (house rule): clauses are joined with commas / "and" / middots.
export function buildAnswerSentence(promos: PromoWithTeam[]): string {
  const n = promos.length;
  if (n === 0) return '';
  const groups = groupPromosByLeague(promos);
  const leaguePart = joinList(groups.map((g) => g.label));
  const descriptors = promos.slice(0, 3).map((p) => `${p.title} at ${teamDisplayName(p.team)}`);
  const more = n - descriptors.length;
  const tail = more > 0 ? `, and ${more} more` : '';
  const noun = n === 1 ? 'game' : 'games';
  const verb = n === 1 ? 'has' : 'have';
  return `${n} ${noun} today ${verb} promotions across ${leaguePart}: ${joinList(descriptors)}${tail}.`;
}

// Quantity / sponsor detail line under a card title (e.g. "First 15,000 fans").
// Returns '' when the promo carries none of these fields. No em dashes.
export function promoDetailLine(p: PromoWithTeam): string {
  const parts: string[] = [];
  if (typeof p.attendanceCap === 'number' && p.attendanceCap > 0) {
    parts.push(`First ${p.attendanceCap.toLocaleString('en-US')} fans`);
  } else if (p.whileSuppliesLast) {
    parts.push('While supplies last');
  }
  if (p.presentedBy) parts.push(`Presented by ${p.presentedBy}`);
  return parts.join(' · ');
}

// "Saturday, July 18" — the human date for a YYYY-MM-DD, anchored at noon so the
// weekday never slips a day across time zones.
export function formatBoardDate(ymd: string): string {
  return new Date(ymd + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

// Promo `time` is a bare display string. When it is a plain "HH:MM" clock, show
// it as a 12-hour time ("7:10 PM"); otherwise pass it through unchanged. No time
// zone is appended — promos carry no per-venue tz, so inventing one would be
// wrong.
export function formatClock(time: string | undefined): string {
  if (!time) return '';
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m) return time;
  let h = Number(m[1]);
  const min = m[2];
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${min} ${ampm}`;
}
