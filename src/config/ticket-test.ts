// StubHub vs TicketNetwork 60-day crossover test: the ONE config file
// (decided design 2026-11-25; Gate 0, 1 and 2 rulings).
//
// ONE VARIABLE: the partner behind the ticket button on a test team's own
// pages (its team page and its promo pages). Button look, label and placement
// are the same on both arms.
//
// THE SWITCH. NEXT_PUBLIC_TICKET_TEST === 'true' (src/lib/ticket-test.ts
// isTicketTestOn). Unset or anything else: this file is inert and every page
// renders exactly as before.
//
// DATES are site days (America/New_York), inclusive start, exclusive end.
// Phase A runs from startDate up to flipDate, phase B from flipDate up to
// endDate. Every club swaps partners at flipDate. Outside [startDate, endDate)
// the test is off even with the switch on. The flip lands on an Eastern
// midnight, so the 00:15 Eastern refresh carries it (src/lib/nightly-refresh.ts).
//
// LEAGUES: NBA, NHL and NFL. MLB waits for its 2027 schedule on the games
// spine, MLS has no games spine, WNBA is out of season.
//
// PAIRS are generated, never typed: src/lib/ticket-test-pairing.ts from
// `ranking` and `seed`. The literal below is that function's output, and the
// pairing test fails when the two disagree. `arm` is the partner a club shows
// in phase A; it shows the other one in phase B.
import type { TicketTestPair, TicketTestRankRow } from '@/lib/ticket-test-pairing';

export type TicketTestLeague = 'nba' | 'nhl' | 'nfl';

export const TICKET_TEST = {
  seed: 'stubhub-ticketnetwork-2026-11-25',
  /** First site day of phase A. Set at launch (Phase 4). */
  startDate: '2026-12-01',
  /** First site day of phase B: start + 30 days. */
  flipDate: '2026-12-31',
  /** First site day after the test: start + 60 days. */
  endDate: '2027-01-30',
  leagues: ['nba', 'nhl', 'nfl'] as readonly TicketTestLeague[],
  /** Always StubHub on the test's surfaces, outside the pairs: TicketNetwork
   *  lists no home events at these clubs' buildings (tnHomeUnavailable). */
  alwaysStubHub: ['ottawa-senators', 'toronto-maple-leafs', 'toronto-raptors'] as readonly string[],
} as const;

// Ranking snapshot: PostHog affiliate_click, Regular traffic, ticket partners,
// 2026-10-26 to 2026-11-25. The order inside a tie is the snapshot's own.
const r = (team: string, clicks: number): TicketTestRankRow => ({ team, clicks });
export const TICKET_TEST_RANKING: Readonly<Record<TicketTestLeague, readonly TicketTestRankRow[]>> = {
  nba: [r('portland-trail-blazers', 196), r('san-antonio-spurs', 178), r('milwaukee-bucks', 103), r('chicago-bulls', 95), r('minnesota-timberwolves', 83), r('golden-state-warriors', 80), r('houston-rockets', 70), r('los-angeles-lakers', 34), r('boston-celtics', 31), r('indiana-pacers', 28), r('denver-nuggets', 27), r('detroit-pistons', 25), r('new-york-knicks', 24), r('brooklyn-nets', 24), r('philadelphia-76ers', 23), r('charlotte-hornets', 19), r('dallas-mavericks', 19), r('memphis-grizzlies', 17), r('phoenix-suns', 16), r('sacramento-kings', 16), r('new-orleans-pelicans', 11), r('miami-heat', 10), r('los-angeles-clippers', 10), r('cleveland-cavaliers', 8), r('atlanta-hawks', 8), r('orlando-magic', 5), r('utah-jazz', 2), r('oklahoma-city-thunder', 2), r('washington-wizards', 2)],
  nhl: [r('minnesota-wild', 77), r('detroit-red-wings', 76), r('nashville-predators', 63), r('anaheim-ducks', 49), r('philadelphia-flyers', 47), r('pittsburgh-penguins', 45), r('los-angeles-kings', 42), r('st-louis-blues', 33), r('colorado-avalanche', 31), r('san-jose-sharks', 22), r('montreal-canadiens', 20), r('carolina-hurricanes', 19), r('washington-capitals', 18), r('calgary-flames', 18), r('tampa-bay-lightning', 16), r('new-york-rangers', 16), r('vegas-golden-knights', 14), r('new-jersey-devils', 13), r('chicago-blackhawks', 13), r('dallas-stars', 13), r('columbus-blue-jackets', 10), r('florida-panthers', 10), r('new-york-islanders', 10), r('buffalo-sabres', 9), r('boston-bruins', 7), r('vancouver-canucks', 5), r('winnipeg-jets', 5), r('seattle-kraken', 2), r('edmonton-oilers', 2), r('utah-hockey-club', 0)],
  nfl: [r('chicago-bears', 28), r('denver-broncos', 24), r('los-angeles-chargers', 15), r('san-francisco-49ers', 14), r('detroit-lions', 14), r('buffalo-bills', 13), r('dallas-cowboys', 9), r('houston-texans', 7), r('washington-commanders', 7), r('miami-dolphins', 7), r('baltimore-ravens', 5), r('indianapolis-colts', 4), r('arizona-cardinals', 4), r('pittsburgh-steelers', 4), r('new-york-giants', 4), r('seattle-seahawks', 3), r('minnesota-vikings', 3), r('tampa-bay-buccaneers', 3), r('carolina-panthers', 3), r('tennessee-titans', 2), r('las-vegas-raiders', 2), r('philadelphia-eagles', 2), r('kansas-city-chiefs', 2), r('new-england-patriots', 2), r('atlanta-falcons', 2), r('new-york-jets', 2), r('jacksonville-jaguars', 2), r('cincinnati-bengals', 1), r('cleveland-browns', 0), r('green-bay-packers', 0), r('los-angeles-rams', 0), r('new-orleans-saints', 0)],
};

// generatePairs(league, TICKET_TEST_RANKING[league], TICKET_TEST.seed), verbatim.
export const TICKET_TEST_PAIRS: Readonly<Record<TicketTestLeague, readonly TicketTestPair[]>> = {
  nba: [
    { pairId: 'nba-01', teams: [{ team: 'portland-trail-blazers', clicks: 196, arm: 'ticketnetwork_first' }, { team: 'san-antonio-spurs', clicks: 178, arm: 'stubhub_first' }] },
    { pairId: 'nba-02', teams: [{ team: 'milwaukee-bucks', clicks: 103, arm: 'ticketnetwork_first' }, { team: 'chicago-bulls', clicks: 95, arm: 'stubhub_first' }] },
    { pairId: 'nba-03', teams: [{ team: 'minnesota-timberwolves', clicks: 83, arm: 'ticketnetwork_first' }, { team: 'golden-state-warriors', clicks: 80, arm: 'stubhub_first' }] },
    { pairId: 'nba-04', teams: [{ team: 'houston-rockets', clicks: 70, arm: 'ticketnetwork_first' }, { team: 'los-angeles-lakers', clicks: 34, arm: 'stubhub_first' }] },
    { pairId: 'nba-05', teams: [{ team: 'boston-celtics', clicks: 31, arm: 'ticketnetwork_first' }, { team: 'indiana-pacers', clicks: 28, arm: 'stubhub_first' }] },
    { pairId: 'nba-06', teams: [{ team: 'denver-nuggets', clicks: 27, arm: 'stubhub_first' }, { team: 'detroit-pistons', clicks: 25, arm: 'ticketnetwork_first' }] },
    { pairId: 'nba-07', teams: [{ team: 'new-york-knicks', clicks: 24, arm: 'ticketnetwork_first' }, { team: 'brooklyn-nets', clicks: 24, arm: 'stubhub_first' }] },
    { pairId: 'nba-08', teams: [{ team: 'philadelphia-76ers', clicks: 23, arm: 'ticketnetwork_first' }, { team: 'charlotte-hornets', clicks: 19, arm: 'stubhub_first' }] },
    { pairId: 'nba-09', teams: [{ team: 'dallas-mavericks', clicks: 19, arm: 'ticketnetwork_first' }, { team: 'memphis-grizzlies', clicks: 17, arm: 'stubhub_first' }] },
    { pairId: 'nba-10', teams: [{ team: 'phoenix-suns', clicks: 16, arm: 'ticketnetwork_first' }, { team: 'sacramento-kings', clicks: 16, arm: 'stubhub_first' }] },
    { pairId: 'nba-11', teams: [{ team: 'new-orleans-pelicans', clicks: 11, arm: 'stubhub_first' }, { team: 'miami-heat', clicks: 10, arm: 'ticketnetwork_first' }] },
    { pairId: 'nba-12', teams: [{ team: 'los-angeles-clippers', clicks: 10, arm: 'stubhub_first' }, { team: 'cleveland-cavaliers', clicks: 8, arm: 'ticketnetwork_first' }] },
    { pairId: 'nba-13', teams: [{ team: 'atlanta-hawks', clicks: 8, arm: 'stubhub_first' }, { team: 'orlando-magic', clicks: 5, arm: 'ticketnetwork_first' }] },
    { pairId: 'nba-14', teams: [{ team: 'utah-jazz', clicks: 2, arm: 'stubhub_first' }, { team: 'oklahoma-city-thunder', clicks: 2, arm: 'ticketnetwork_first' }] },
    { pairId: 'nba-15', teams: [{ team: 'washington-wizards', clicks: 2, arm: 'stubhub_first' }] },
  ],
  nhl: [
    { pairId: 'nhl-01', teams: [{ team: 'minnesota-wild', clicks: 77, arm: 'ticketnetwork_first' }, { team: 'detroit-red-wings', clicks: 76, arm: 'stubhub_first' }] },
    { pairId: 'nhl-02', teams: [{ team: 'nashville-predators', clicks: 63, arm: 'ticketnetwork_first' }, { team: 'anaheim-ducks', clicks: 49, arm: 'stubhub_first' }] },
    { pairId: 'nhl-03', teams: [{ team: 'philadelphia-flyers', clicks: 47, arm: 'ticketnetwork_first' }, { team: 'pittsburgh-penguins', clicks: 45, arm: 'stubhub_first' }] },
    { pairId: 'nhl-04', teams: [{ team: 'los-angeles-kings', clicks: 42, arm: 'stubhub_first' }, { team: 'st-louis-blues', clicks: 33, arm: 'ticketnetwork_first' }] },
    { pairId: 'nhl-05', teams: [{ team: 'colorado-avalanche', clicks: 31, arm: 'stubhub_first' }, { team: 'san-jose-sharks', clicks: 22, arm: 'ticketnetwork_first' }] },
    { pairId: 'nhl-06', teams: [{ team: 'montreal-canadiens', clicks: 20, arm: 'stubhub_first' }, { team: 'carolina-hurricanes', clicks: 19, arm: 'ticketnetwork_first' }] },
    { pairId: 'nhl-07', teams: [{ team: 'washington-capitals', clicks: 18, arm: 'stubhub_first' }, { team: 'calgary-flames', clicks: 18, arm: 'ticketnetwork_first' }] },
    { pairId: 'nhl-08', teams: [{ team: 'tampa-bay-lightning', clicks: 16, arm: 'ticketnetwork_first' }, { team: 'new-york-rangers', clicks: 16, arm: 'stubhub_first' }] },
    { pairId: 'nhl-09', teams: [{ team: 'vegas-golden-knights', clicks: 14, arm: 'ticketnetwork_first' }, { team: 'new-jersey-devils', clicks: 13, arm: 'stubhub_first' }] },
    { pairId: 'nhl-10', teams: [{ team: 'chicago-blackhawks', clicks: 13, arm: 'ticketnetwork_first' }, { team: 'dallas-stars', clicks: 13, arm: 'stubhub_first' }] },
    { pairId: 'nhl-11', teams: [{ team: 'columbus-blue-jackets', clicks: 10, arm: 'ticketnetwork_first' }, { team: 'florida-panthers', clicks: 10, arm: 'stubhub_first' }] },
    { pairId: 'nhl-12', teams: [{ team: 'new-york-islanders', clicks: 10, arm: 'ticketnetwork_first' }, { team: 'buffalo-sabres', clicks: 9, arm: 'stubhub_first' }] },
    { pairId: 'nhl-13', teams: [{ team: 'boston-bruins', clicks: 7, arm: 'ticketnetwork_first' }, { team: 'vancouver-canucks', clicks: 5, arm: 'stubhub_first' }] },
    { pairId: 'nhl-14', teams: [{ team: 'winnipeg-jets', clicks: 5, arm: 'ticketnetwork_first' }, { team: 'seattle-kraken', clicks: 2, arm: 'stubhub_first' }] },
    { pairId: 'nhl-15', teams: [{ team: 'edmonton-oilers', clicks: 2, arm: 'ticketnetwork_first' }, { team: 'utah-hockey-club', clicks: 0, arm: 'stubhub_first' }] },
  ],
  nfl: [
    { pairId: 'nfl-01', teams: [{ team: 'chicago-bears', clicks: 28, arm: 'stubhub_first' }, { team: 'denver-broncos', clicks: 24, arm: 'ticketnetwork_first' }] },
    { pairId: 'nfl-02', teams: [{ team: 'los-angeles-chargers', clicks: 15, arm: 'stubhub_first' }, { team: 'san-francisco-49ers', clicks: 14, arm: 'ticketnetwork_first' }] },
    { pairId: 'nfl-03', teams: [{ team: 'detroit-lions', clicks: 14, arm: 'stubhub_first' }, { team: 'buffalo-bills', clicks: 13, arm: 'ticketnetwork_first' }] },
    { pairId: 'nfl-04', teams: [{ team: 'dallas-cowboys', clicks: 9, arm: 'stubhub_first' }, { team: 'houston-texans', clicks: 7, arm: 'ticketnetwork_first' }] },
    { pairId: 'nfl-05', teams: [{ team: 'washington-commanders', clicks: 7, arm: 'ticketnetwork_first' }, { team: 'miami-dolphins', clicks: 7, arm: 'stubhub_first' }] },
    { pairId: 'nfl-06', teams: [{ team: 'baltimore-ravens', clicks: 5, arm: 'ticketnetwork_first' }, { team: 'indianapolis-colts', clicks: 4, arm: 'stubhub_first' }] },
    { pairId: 'nfl-07', teams: [{ team: 'arizona-cardinals', clicks: 4, arm: 'ticketnetwork_first' }, { team: 'pittsburgh-steelers', clicks: 4, arm: 'stubhub_first' }] },
    { pairId: 'nfl-08', teams: [{ team: 'new-york-giants', clicks: 4, arm: 'stubhub_first' }, { team: 'seattle-seahawks', clicks: 3, arm: 'ticketnetwork_first' }] },
    { pairId: 'nfl-09', teams: [{ team: 'minnesota-vikings', clicks: 3, arm: 'stubhub_first' }, { team: 'tampa-bay-buccaneers', clicks: 3, arm: 'ticketnetwork_first' }] },
    { pairId: 'nfl-10', teams: [{ team: 'carolina-panthers', clicks: 3, arm: 'stubhub_first' }, { team: 'tennessee-titans', clicks: 2, arm: 'ticketnetwork_first' }] },
    { pairId: 'nfl-11', teams: [{ team: 'las-vegas-raiders', clicks: 2, arm: 'stubhub_first' }, { team: 'philadelphia-eagles', clicks: 2, arm: 'ticketnetwork_first' }] },
    { pairId: 'nfl-12', teams: [{ team: 'kansas-city-chiefs', clicks: 2, arm: 'stubhub_first' }, { team: 'new-england-patriots', clicks: 2, arm: 'ticketnetwork_first' }] },
    { pairId: 'nfl-13', teams: [{ team: 'atlanta-falcons', clicks: 2, arm: 'stubhub_first' }, { team: 'new-york-jets', clicks: 2, arm: 'ticketnetwork_first' }] },
    { pairId: 'nfl-14', teams: [{ team: 'jacksonville-jaguars', clicks: 2, arm: 'ticketnetwork_first' }, { team: 'cincinnati-bengals', clicks: 1, arm: 'stubhub_first' }] },
    { pairId: 'nfl-15', teams: [{ team: 'cleveland-browns', clicks: 0, arm: 'stubhub_first' }, { team: 'green-bay-packers', clicks: 0, arm: 'ticketnetwork_first' }] },
    { pairId: 'nfl-16', teams: [{ team: 'los-angeles-rams', clicks: 0, arm: 'stubhub_first' }, { team: 'new-orleans-saints', clicks: 0, arm: 'ticketnetwork_first' }] },
  ],
};
