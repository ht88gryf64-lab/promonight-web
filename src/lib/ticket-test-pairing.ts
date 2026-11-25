// Stratified pairs for the StubHub vs TicketNetwork crossover test (decided
// design, 2026-11-25). Pure and deterministic: the same ranking and seed give
// the same pairs and arms on every machine, which the pairing test pins
// against the literal in src/config/ticket-test.ts.
//
// Per league: clubs ranked by 30-day ticket affiliate clicks (the snapshot's
// own order breaks ties; clubs with 0 clicks go last, alphabetical), neighbors
// paired (#1 with #2, #3 with #4 ...), one seeded coin flip inside each pair.
// An odd club out is its own pair with its own flip.

export type TicketTestArm = 'stubhub_first' | 'ticketnetwork_first';

export interface TicketTestRankRow {
  team: string;
  clicks: number;
}

export interface TicketTestPair {
  /** "{league}-{nn}", 1-based rank order: nba-01 holds the two most clicked clubs. */
  pairId: string;
  /** One club for an odd club out. Each carries its arm: the partner it shows in phase A. */
  teams: { team: string; clicks: number; arm: TicketTestArm }[];
}

// FNV-1a over the key, then one mulberry32 step: a float in [0, 1).
function seededUnit(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  let t = (h + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** The ranking in pairing order: clicks descending, the given order inside a
 *  tie, and every 0-click club last in alphabetical order. */
export function rankForPairing(rows: readonly TicketTestRankRow[]): TicketTestRankRow[] {
  const withClicks = rows.map((r, i) => ({ r, i })).filter((x) => x.r.clicks > 0);
  withClicks.sort((a, b) => b.r.clicks - a.r.clicks || a.i - b.i);
  const zeros = rows.filter((r) => r.clicks <= 0).slice().sort((a, b) => a.team.localeCompare(b.team));
  return [...withClicks.map((x) => x.r), ...zeros];
}

export function generatePairs(league: string, rows: readonly TicketTestRankRow[], seed: string): TicketTestPair[] {
  const ranked = rankForPairing(rows);
  const pairs: TicketTestPair[] = [];
  for (let i = 0; i < ranked.length; i += 2) {
    const n = i / 2 + 1;
    const pairId = `${league}-${String(n).padStart(2, '0')}`;
    const heads = seededUnit(`${seed}|${league}|${n}`) < 0.5;
    const first: TicketTestArm = heads ? 'stubhub_first' : 'ticketnetwork_first';
    const second: TicketTestArm = heads ? 'ticketnetwork_first' : 'stubhub_first';
    const teams = [{ team: ranked[i].team, clicks: ranked[i].clicks, arm: first }];
    if (ranked[i + 1]) teams.push({ team: ranked[i + 1].team, clicks: ranked[i + 1].clicks, arm: second });
    pairs.push({ pairId, teams });
  }
  return pairs;
}
