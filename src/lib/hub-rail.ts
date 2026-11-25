// THE LEAGUE HUB "THIS WEEK" RAIL, AS DATA. Pure and client-safe.
//
// One card per TEAM: the team's soonest promo day inside the slate window,
// with every promo it has that day listed inside the card, and a count of the
// other days it has promos that week. Up to HUB_RAIL_TEAM_LIMIT teams, soonest
// first.
//
// WHY (2026-11-25). The rail used to take the first eight ROWS of the slate.
// The slate is deduped per team, date and title, not per team, so on /nba
// that day the first eight rows belonged to four teams (Warriors 1, 76ers 2,
// Pistons 3, Hornets 2) under a stat bar that said 13 teams had a promo that
// week, and two cards for one team shared a React key. Counting teams here,
// from the same slate the stat bar counts, is what lets the rail say "8 of 13".

import type { PromoWithTeam } from './types';

export const HUB_RAIL_TEAM_LIMIT = 8;

export interface HubRailCard {
  team: PromoWithTeam['team'];
  /** The team's soonest promo day in the slate, YYYY-MM-DD. */
  date: string;
  /** Every promo the team has on `date`, in slate order. Never empty. */
  promos: PromoWithTeam[];
  /** Other days in the slate on which the team has a promo. */
  moreDays: number;
}

export interface HubRail {
  cards: HubRailCard[];
  /** Distinct teams in the whole slate: the stat bar's "teams with a promo this week". */
  teamsTotal: number;
}

export function buildHubRail(slate: readonly PromoWithTeam[], limit: number = HUB_RAIL_TEAM_LIMIT): HubRail {
  const byTeam = new Map<string, PromoWithTeam[]>();
  for (const p of slate) {
    const list = byTeam.get(p.team.id);
    if (list) list.push(p);
    else byTeam.set(p.team.id, [p]);
  }
  const all: HubRailCard[] = [];
  for (const rows of byTeam.values()) {
    const date = rows.reduce((acc, p) => (p.date < acc ? p.date : acc), rows[0].date);
    const days = new Set(rows.map((p) => p.date));
    all.push({ team: rows[0].team, date, promos: rows.filter((p) => p.date === date), moreDays: days.size - 1 });
  }
  // Soonest day first; within a day, the order the teams first appear in the slate.
  const firstSeen = new Map([...byTeam.keys()].map((id, i) => [id, i]));
  all.sort((a, b) => a.date.localeCompare(b.date) || (firstSeen.get(a.team.id) ?? 0) - (firstSeen.get(b.team.id) ?? 0));
  return { cards: all.slice(0, Math.max(0, limit)), teamsTotal: byTeam.size };
}

/** "Showing 8 of 13 teams" when the rail is cut, null when it shows them all. */
export function hubRailCountLine(rail: HubRail): string | null {
  return rail.cards.length < rail.teamsTotal ? `Showing ${rail.cards.length} of ${rail.teamsTotal} teams` : null;
}
