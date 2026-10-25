// Per-league team taxonomy: which division or conference bucket each team
// falls into, in what order, and under which super-header band. Pure (no
// Firestore, no clock, no locale), so the league hubs (through data.ts) and the
// /teams browser group teams identically and tests can import it directly.

import type { Team } from './types';
import { nbaConferenceOf } from './nba-hub';

// A grouped bucket of a league's teams for the hub "browse by team" grid. `key`
// is the group's display label and selector chip value (e.g. "AL East" or
// "Eastern"). `superGroup` is the super-header band this group sits under ("AL"
// / "NL" for MLB); null for leagues that group flat (WNBA / MLS).
export interface HubTeamGroup {
  key: string;
  superGroup: string | null;
  teams: Team[];
}

// A super-header band rendered above the groups (MLB's AL / NL). The list is
// empty for leagues that group flat.
export interface HubSuperGroup {
  key: string;
  label: string;
}

// Per-league grouping spec. `groupOrder` is the canonical display order of the
// buckets teams fall into via team.division. `superGroups` + `superGroupOf`, when
// set, add the two-band super-header layer (MLB AL / NL); omitting them makes the
// league render its groups as top-level buckets. Keyed by league code, aligned
// with LEAGUE_HUB_REGISTRY.
interface HubGroupingSpec {
  groupOrder: string[];
  superGroups?: HubSuperGroup[];
  superGroupOf?: (groupKey: string) => string;
}

const HUB_GROUPING: Record<string, HubGroupingSpec> = {
  MLB: {
    groupOrder: ['AL East', 'AL Central', 'AL West', 'NL East', 'NL Central', 'NL West'],
    superGroups: [
      { key: 'AL', label: 'American League' },
      { key: 'NL', label: 'National League' },
    ],
    superGroupOf: (key) => (key.startsWith('NL') ? 'NL' : 'AL'),
  },
  // WNBA and MLS both seed team.division as "Eastern" / "Western" (15/15 and
  // 30/30). No AL/NL-style super-header: the two conferences ARE the top-level
  // buckets, so groupOrder alone drives the grid.
  WNBA: { groupOrder: ['Eastern', 'Western'] },
  MLS: { groupOrder: ['Eastern', 'Western'] },
  // NFL mirrors the MLB shape: 8 divisions under two super-header bands.
  // Division strings verified against the teams collection 2026-08-06:
  // exactly these 8 values, 4 clubs each, same "ABBREV Region" style as
  // MLB's "AL East". Long band labels match how MLB renders AL/NL.
  NFL: {
    groupOrder: [
      'AFC East', 'AFC North', 'AFC South', 'AFC West',
      'NFC East', 'NFC North', 'NFC South', 'NFC West',
    ],
    superGroups: [
      { key: 'AFC', label: 'American Football Conference' },
      { key: 'NFC', label: 'National Football Conference' },
    ],
    superGroupOf: (key) => (key.startsWith('NFC') ? 'NFC' : 'AFC'),
  },
  // NHL: four divisions under two conference bands. Division strings verified
  // against the teams collection 2026-09-01 (read-only): exactly these four
  // values, 8 clubs each (32/32), and NO conference field on any doc, so the
  // band is derived from the division here rather than read. utah-hockey-club
  // (display "Utah Mammoth") sits in Central with the rest.
  NHL: {
    groupOrder: ['Atlantic', 'Metropolitan', 'Central', 'Pacific'],
    superGroups: [
      { key: 'Eastern', label: 'Eastern Conference' },
      { key: 'Western', label: 'Western Conference' },
    ],
    superGroupOf: (key) => (key === 'Central' || key === 'Pacific' ? 'Western' : 'Eastern'),
  },
  // NBA: six divisions under two conference bands, the NHL shape. Atlantic,
  // Central and Pacific share names with NHL divisions; the spec is keyed by
  // league, so they never mix. NOT verified against the teams collection from
  // this session (no Firestore access); the strings match the team fixture in
  // fan-tools.test.tsx ('Northwest' for the Timberwolves) and the pipeline's
  // nba-teams.js grouping. A doc carrying any other string is not dropped:
  // getLeagueTeamsGrouped appends unknown keys after the canonical six, and
  // nbaConferenceOf still bands it by name.
  NBA: {
    groupOrder: ['Atlantic', 'Central', 'Southeast', 'Northwest', 'Pacific', 'Southwest'],
    superGroups: [
      { key: 'Eastern', label: 'Eastern Conference' },
      { key: 'Western', label: 'Western Conference' },
    ],
    superGroupOf: nbaConferenceOf,
  },
};

// The super-header bands for a league (empty when the league groups flat).
export function leagueSuperGroups(league: string): HubSuperGroup[] {
  return HUB_GROUPING[league]?.superGroups ?? [];
}

// Buckets one league's teams by their `division` field into ordered groups,
// tagging each with its super-header key (or null). Groups come back in the
// spec's canonical order; any key outside it is appended, sorted, so a team is
// never silently dropped. Teams keep their INPUT order within a group: callers
// that want another order sort afterwards (getLeagueTeamsGrouped does).
export function groupLeagueTeams(inLeague: readonly Team[], league: string): HubTeamGroup[] {
  const spec = HUB_GROUPING[league] ?? { groupOrder: [] };

  const byKey = new Map<string, Team[]>();
  for (const t of inLeague) {
    const key = t.division || 'Other';
    const list = byKey.get(key) ?? [];
    list.push(t);
    byKey.set(key, list);
  }

  const canonical = new Set<string>(spec.groupOrder);
  const extraKeys = [...byKey.keys()].filter((k) => !canonical.has(k)).sort();
  const orderedKeys = [...spec.groupOrder, ...extraKeys];

  const groups: HubTeamGroup[] = [];
  for (const key of orderedKeys) {
    const list = byKey.get(key);
    if (!list || list.length === 0) continue;
    const superGroup = spec.superGroupOf ? spec.superGroupOf(key) : null;
    groups.push({ key, superGroup, teams: list });
  }
  return groups;
}
