// Server-side data layer for the /world-cup hub.
//
// For each host-city MLB team, this pulls HOME games inside the World Cup
// window (June 11 to July 19, 2026), joins each game to that day's promos via
// the existing enrichGamesForTeam date-join, and derives soccer-jersey-night
// entries by precise title/text match. All reads happen server-side so the
// page ships its city and game content in the static HTML for crawlers.

import 'server-only';
import {
  getTeamBySlug,
  getVenueForTeam,
  getGamesForTeam,
  getTeamPromos,
  enrichGamesForTeam,
  type GameContext,
} from './data';
import type { Team, Venue, Promo } from './types';
import { isSoccerJerseyPromo } from './soccer-jersey';
import {
  WORLD_CUP_CITIES,
  WORLD_CUP_WINDOW_START,
  WORLD_CUP_WINDOW_END,
  type WorldCupCity,
  type WorldCupTeamRef,
} from '@/data/world-cup-cities';

export interface WorldCupTeamData {
  ref: WorldCupTeamRef;
  team: Team | null;
  venue: Venue | null;
  /** Home games inside the window, sorted by date, enriched with promos. */
  homeGames: GameContext[];
}

export interface WorldCupCityData {
  city: WorldCupCity;
  /** Primary team first, then secondary (NY / NJ adds the Mets). */
  teams: WorldCupTeamData[];
  /** True when at least one team has a home game in the window. */
  hasAnyGames: boolean;
  totalHomeGames: number;
}

export interface SoccerJerseyEntry {
  citySlug: string;
  teamSlug: string;
  teamDisplay: string;
  promo: Promo;
}

export interface WorldCupData {
  cities: WorldCupCityData[];
  soccerJerseyEntries: SoccerJerseyEntry[];
  /** Count of distinct home games across all cities (for the intro capsule). */
  totalHomeGames: number;
}

function inWindow(date: string): boolean {
  return date >= WORLD_CUP_WINDOW_START && date <= WORLD_CUP_WINDOW_END;
}

async function loadTeam(ref: WorldCupTeamRef): Promise<WorldCupTeamData> {
  const team = await getTeamBySlug(ref.slug);
  if (!team) {
    return { ref, team: null, venue: null, homeGames: [] };
  }

  const [venue, games, promos] = await Promise.all([
    getVenueForTeam(team.id),
    // sportSlug is the lowercase league ('mlb') that getGamesForTeam expects.
    getGamesForTeam(team.id, team.sportSlug),
    getTeamPromos(team.id),
  ]);

  // Home games only, inside the window, excluding canceled fixtures.
  const homeGames = games.filter(
    (g) =>
      g.homeTeamSlug === team.id &&
      inWindow(g.date) &&
      g.status !== 'canceled',
  );

  // Reuse the canonical date-join: home games get the team's own promos for
  // that date, plus the opponent team for display.
  const enriched =
    homeGames.length > 0
      ? await enrichGamesForTeam(team.id, homeGames, promos)
      : [];

  return { ref, team, venue, homeGames: enriched };
}

export async function getWorldCupData(): Promise<WorldCupData> {
  const cities = await Promise.all(
    WORLD_CUP_CITIES.map(async (city): Promise<WorldCupCityData> => {
      const refs: WorldCupTeamRef[] = city.secondaryTeam
        ? [city.primaryTeam, city.secondaryTeam]
        : [city.primaryTeam];
      const teams = await Promise.all(refs.map(loadTeam));
      const totalHomeGames = teams.reduce((n, t) => n + t.homeGames.length, 0);
      return { city, teams, hasAnyGames: totalHomeGames > 0, totalHomeGames };
    }),
  );

  // Derive soccer-jersey entries from the promos already attached to in-window
  // home games. Dedupe by team + promo title + date so a recurring promo that
  // lands on multiple game dates is only teased once per date.
  const seen = new Set<string>();
  const soccerJerseyEntries: SoccerJerseyEntry[] = [];
  for (const cityData of cities) {
    for (const teamData of cityData.teams) {
      for (const ctx of teamData.homeGames) {
        for (const promo of ctx.promos) {
          if (!isSoccerJerseyPromo(promo, teamData.team?.league)) continue;
          const key = `${teamData.ref.slug}:${promo.date}:${promo.title}`;
          if (seen.has(key)) continue;
          seen.add(key);
          soccerJerseyEntries.push({
            citySlug: cityData.city.slug,
            teamSlug: teamData.ref.slug,
            teamDisplay: teamData.ref.display,
            promo,
          });
        }
      }
    }
  }
  soccerJerseyEntries.sort((a, b) => a.promo.date.localeCompare(b.promo.date));

  const totalHomeGames = cities.reduce((n, c) => n + c.totalHomeGames, 0);

  return { cities, soccerJerseyEntries, totalHomeGames };
}
