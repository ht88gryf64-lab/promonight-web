import 'server-only';
import { getPromosInDateRange } from './data';
import { PROMO_TYPE_LABELS, SPORT_ICONS, type PromoWithTeam } from './types';

// Weekly-digest assembly. The window's promos are fetched ONCE per run via
// getPromosInDateRange (a single deduped collection-group query, deduped by
// teamId::date::title upstream), then filtered in memory per subscriber:
// personalized = the subscriber's teams; generic = the highlighted "hot" set.
// No email lives here; this is pure data shaping.

export const DIGEST_WINDOW_DAYS = 7;
// Generic email featured-promo cap and personalized digest cap.
const GENERIC_FEATURED_CAP = 8;
const PERSONALIZED_CAP = 40;

export interface DigestPromo {
  date: string; // YYYY-MM-DD
  title: string;
  typeLabel: string;
  icon: string;
  highlight: boolean;
  time: string;
  opponent: string;
  teamId: string;
  teamName: string; // "City Name"
  league: string;
  leagueIcon: string;
  sportSlug: string;
}

export interface DigestCollection {
  label: string;
  href: string; // root-relative; the email builder makes it absolute
}

// Aggregator collection pages the generic email links to.
export const DIGEST_COLLECTIONS: DigestCollection[] = [
  { label: 'Hot this week', href: '/promos/this-week' },
  { label: 'Bobblehead giveaways', href: '/promos/bobbleheads' },
  { label: 'Jersey giveaways', href: '/promos/jersey-giveaways' },
  { label: 'Theme nights', href: '/promos/theme-nights' },
  { label: 'Food deals', href: '/promos/food-deals' },
];

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

// Inclusive [start, end] YYYY-MM-DD window covering today plus the next 6 days =
// 7 calendar days. Ending at now + (DAYS - 1) keeps it a true 7-day span: with
// the weekly Tuesday cron, consecutive windows are contiguous (Tue..Mon, next
// Tue..Mon) and never share a boundary date, so a promo can't land in two
// back-to-back digests.
export function digestWindow(now: Date): { start: string; end: string } {
  return { start: ymd(now), end: ymd(addDays(now, DIGEST_WINDOW_DAYS - 1)) };
}

function toDigestPromo(p: PromoWithTeam): DigestPromo {
  return {
    date: p.date,
    title: p.title,
    typeLabel: PROMO_TYPE_LABELS[p.type] ?? 'Promo',
    icon: p.icon,
    highlight: p.highlight,
    time: p.time,
    opponent: p.opponent,
    teamId: p.team.id,
    teamName: `${p.team.city} ${p.team.name}`,
    league: p.team.league,
    leagueIcon: SPORT_ICONS[p.team.league] ?? '',
    sportSlug: p.team.sportSlug,
  };
}

// Every promo in the window, deduped + date-sorted, fetched once per run.
export async function fetchWindowPromos(start: string, end: string): Promise<DigestPromo[]> {
  const promos = await getPromosInDateRange(start, end);
  return promos.map(toDigestPromo);
}

// Promos in the window for a personalized subscriber's followed teams. Returns
// the capped list AND the true pre-cap total so the email can report an honest
// count and show an overflow note instead of silently dropping later promos.
// total === 0 is the signal to SKIP that subscriber for the week (no empty send).
export function personalizedFor(
  windowPromos: DigestPromo[],
  teamIds: string[],
): { promos: DigestPromo[]; total: number } {
  const set = new Set(teamIds);
  const filtered = windowPromos.filter((p) => set.has(p.teamId));
  return { promos: filtered.slice(0, PERSONALIZED_CAP), total: filtered.length };
}

// Featured "hot" promos for the generic email: highlighted first (the same
// signal the aggregator surfaces), backfilled with the soonest non-highlighted
// if there aren't enough highlighted ones, capped. windowPromos is already
// date-sorted, so order is preserved within each band.
export function genericFeatured(windowPromos: DigestPromo[]): DigestPromo[] {
  const highlighted = windowPromos.filter((p) => p.highlight);
  if (highlighted.length >= GENERIC_FEATURED_CAP) {
    return highlighted.slice(0, GENERIC_FEATURED_CAP);
  }
  const rest = windowPromos.filter((p) => !p.highlight);
  return [...highlighted, ...rest].slice(0, GENERIC_FEATURED_CAP);
}
