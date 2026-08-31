import { getMatchupIndex } from '@/lib/cfb/matchups';
import { getCoverageCounts } from '@/lib/get-coverage-counts';

// Counts are DERIVED, never hardcoded (aggregator plan §4 discipline): the
// school count reads the cfbSchools collection and the rivalry count reads the
// SAME source /cfb/rivalries renders (getMatchupIndex, which drops registry
// entries whose rivalry doc is missing), so this file cannot drift from the
// pages it describes. force-static is load-bearing: Next 15 route handlers are
// dynamic by default, and only this export makes the GET run at build — where
// a failed Firestore read fails the build loudly (the sitemap's fail-loud rule
// for the same collection) instead of 500ing crawlers at request time.
export const dynamic = 'force-static';

export async function GET() {
  const c = await getCoverageCounts();
  const cfbSchoolCount = c.cfbSchoolCount;
  const rivalryCount = (await getMatchupIndex()).length;

  const content = `# PromoNight

PromoNight is a website, with a companion mobile app for ${c.appLeagueList}, that tracks promotional events -- giveaways, theme nights, food deals, and kids events -- for ${c.teamCount} professional sports teams in ${c.leagueList}, plus 2026 schedules, rivalry games, and gameday travel guides for ${cfbSchoolCount} college football programs.

## Content Categories

- Team promo schedules: upcoming promotional events on record for each of ${c.teamCount} teams
- Giveaway calendars: Bobblehead nights, jersey giveaways, and collectible item schedules
- Completed giveaways: past bobblehead promos stay listed on team pages and the bobblehead calendar, each linking to an eBay search for that item. Resale prices are not tracked or stored
- Theme nights: Star Wars nights, pride nights, faith nights, and other themed game events
- Food deals: Dollar hot dog nights, pregame happy hours, and recurring concession specials
- Kids events: Family days, kids run the bases, and youth-focused promotions
- College football: 2026 schedules, kickoff and TV info once officially announced, and gameday travel plans for ${cfbSchoolCount} programs, plus ${rivalryCount} named rivalry games with date, stadium, and trophy details

## Key Pages

- Homepage: https://www.getpromonight.com/
- Browse all teams: https://www.getpromonight.com/teams
- Team pages: https://www.getpromonight.com/{sport}/{team-slug} (e.g., /mlb/minnesota-twins)
- Best promo nights of the year, score-ranked: https://www.getpromonight.com/best-promos
- Best bobblehead nights of the year, score-ranked: https://www.getpromonight.com/best-promos/bobbleheads
- Team-by-team promo schedule rankings: https://www.getpromonight.com/team-rankings
- College football hub: https://www.getpromonight.com/cfb
- College football school pages: https://www.getpromonight.com/cfb/{school-slug} (e.g., /cfb/ohio-state)
- College football rivalries, all ${rivalryCount} in date order: https://www.getpromonight.com/cfb/rivalries
- Rivalry game pages: https://www.getpromonight.com/cfb/rivalries/{slug} (e.g., /cfb/rivalries/iron-bowl)
- How the data is sourced, checked and published, plus who runs this: https://www.getpromonight.com/about
- Gameday guides by venue: https://www.getpromonight.com/venues
- Sitemap: https://www.getpromonight.com/sitemap.xml

## Organization

- Name: PromoNight
- Contact: hello@getpromonight.com
- Legal name: Kovalik Digital LLC
- Founder and author: Matt Kovalik
- Editorial method and sourcing: https://www.getpromonight.com/about
- App: Available on iOS App Store and Google Play; covers ${c.appLeagueList}
`;

  return new Response(content, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
