export function GET() {
  const content = `# PromoNight

PromoNight is a mobile app and website that tracks every promotional event -- giveaways, theme nights, food deals, and kids events -- across 167 professional sports teams in MLB, NBA, NFL, NHL, MLS, and WNBA.

## Content Categories

- Team promo schedules: Complete lists of upcoming promotional events for each of 167 teams
- Giveaway calendars: Bobblehead nights, jersey giveaways, and collectible item schedules
- Theme nights: Star Wars nights, pride nights, faith nights, and other themed game events
- Food deals: Dollar hot dog nights, pregame happy hours, and recurring concession specials
- Kids events: Family days, kids run the bases, and youth-focused promotions

## Key Pages

- Homepage: https://www.getpromonight.com/
- Browse all teams: https://www.getpromonight.com/teams
- Team pages: https://www.getpromonight.com/{sport}/{team-slug} (e.g., /mlb/minnesota-twins)
- Best promo nights of the year, score-ranked: https://www.getpromonight.com/best-promos
- Best bobblehead nights of the year, score-ranked: https://www.getpromonight.com/best-promos/bobbleheads
- Team-by-team promo schedule rankings: https://www.getpromonight.com/team-rankings
- Sitemap: https://www.getpromonight.com/sitemap.xml

## Organization

- Name: PromoNight
- Contact: hello@getpromonight.com
- App: Available on iOS App Store and Google Play
`;

  return new Response(content, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
