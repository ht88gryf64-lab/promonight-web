/* eslint-disable no-console */
/**
 * Enumerates every URL in the sitemap (homepage, /teams, /playoffs, 167 team
 * pages, /promos/*, /about, /download, /privacy, /terms) and prints the
 * (title, description) pair each would render. Exits non-zero if any title
 * or description is shared by more than one URL.
 *
 * Run with:
 *   node --require ./scripts/stub-server-only.cjs --import tsx \
 *     --env-file=.env.local scripts/check-metadata-dedupe.ts
 *
 * The server-only stub is required because src/lib/data.ts imports
 * `server-only`, which throws outside the Next.js runtime.
 */
import { getAllTeams, getTeamPromos, getVenueForTeam } from '../src/lib/data';
import type { Team } from '../src/lib/types';

const YEAR = new Date().getFullYear();
const BASE = 'https://www.getpromonight.com';

interface PageMeta {
  url: string;
  title: string;
  description: string;
}

// Mirrors the team-page generateMetadata template in
// src/app/[sport]/[team]/page.tsx. Kept in lockstep — if you change one, change
// both (or extract into a shared helper).
async function teamMeta(team: Team): Promise<PageMeta> {
  const [promos, venue] = await Promise.all([
    getTeamPromos(team.id),
    getVenueForTeam(team.id),
  ]);
  const giveaways = promos.filter((p) => p.type === 'giveaway').length;
  const themes = promos.filter((p) => p.type === 'theme').length;
  const kids = promos.filter((p) => p.type === 'kids').length;
  const food = promos.filter((p) => p.type === 'food').length;
  const plural = (n: number, s: string) => `${n} ${s}${n === 1 ? '' : 's'}`;
  const venueClause = venue ? ` at ${venue.name}` : '';
  const title = `${team.city} ${team.name} Promo Schedule ${YEAR}`;
  const description = `All ${YEAR} ${team.city} ${team.name} ${team.league} promo nights${venueClause}: ${plural(giveaways, 'giveaway')}, ${plural(themes, 'theme night')}, ${plural(kids, 'kids day')}, and ${plural(food, 'food deal')}. Updated weekly.`;
  return {
    url: `${BASE}/${team.sportSlug}/${team.id}`,
    title,
    description,
  };
}

// Mirrors the static `export const metadata` blocks for each non-team page.
// Keep in sync with each page's file. The `| PromoNight` suffix from the root
// layout's title.template is appended to every title *except* the homepage
// (which uses title.default and is not templated).
const ROOT_TEMPLATE = ' | PromoNight';
const HOMEPAGE_TITLE =
  'PromoNight: Pro Sports Giveaways, Theme Nights & Food Deals';
const HOMEPAGE_DESCRIPTION =
  'PromoNight tracks every giveaway, theme night, and food deal across 167 teams in MLB, NBA, NFL, NHL, MLS, and WNBA. Never miss bobblehead night.';

const STATIC_PAGES: PageMeta[] = [
  {
    url: `${BASE}/`,
    title: HOMEPAGE_TITLE,
    description: HOMEPAGE_DESCRIPTION,
  },
  {
    url: `${BASE}/teams`,
    title: 'All 167 Pro Sports Teams: Promo Calendars by League' + ROOT_TEMPLATE,
    description:
      '167 pro sports teams across MLB, NBA, NFL, NHL, MLS, and WNBA. Giveaways, theme nights, food deals, and kids days in one team directory.',
  },
  {
    url: `${BASE}/playoffs`,
    title:
      '2026 NBA & NHL Playoff Giveaways & Watch Parties' + ROOT_TEMPLATE,
    description:
      'Every 2026 NBA and NHL playoff promotion: rally towels, T-shirt giveaways, watch parties, and fan events at active teams. Updated hourly from official sources.',
  },
  {
    url: `${BASE}/about`,
    title: 'About PromoNight: The Indie App Behind the Promo Calendar',
    description:
      'Independent app built by a Minnesota sports fan who kept missing the good games. Free, not affiliated with any league. A cleaner way to browse promos.',
  },
  {
    url: `${BASE}/download`,
    title: 'Download PromoNight: Free on iOS & Android',
    description:
      "Install PromoNight free on iOS or Android. Push alerts on every giveaway, theme night, and food deal at your team's home games.",
  },
  {
    url: `${BASE}/privacy`,
    title: "Privacy Policy: What We Collect and How It's Used" + ROOT_TEMPLATE,
    description:
      'PromoNight privacy policy: what we collect on web and mobile, third-party services (analytics, affiliate networks, ads), and how to opt out.',
  },
  {
    url: `${BASE}/terms`,
    title: 'Terms of Service: Usage Rules and Disclaimers' + ROOT_TEMPLATE,
    description:
      'The rules for using PromoNight: as-is service, data accuracy disclaimers, subscription terms for PromoNight Pro, and the usual liability boilerplate.',
  },
  {
    url: `${BASE}/promos/this-week`,
    title: 'Promos This Week: 7-Day Giveaway Tracker' + ROOT_TEMPLATE,
    description:
      'Every promo across MLB, NBA, NHL, NFL, MLS, and WNBA in the next 7 days. Bobbleheads, jerseys, theme nights, food deals. Updated daily.',
  },
  {
    url: `${BASE}/promos/bobbleheads`,
    title: `${YEAR} Bobblehead Giveaways: Player Figurine Nights${ROOT_TEMPLATE}`,
    description: `Every ${YEAR} bobblehead giveaway across MLB, NBA, NHL, NFL, MLS, and WNBA. Player figurines by month with team, date, and opponent. Updated weekly.`,
  },
  {
    url: `${BASE}/promos/jersey-giveaways`,
    title: `${YEAR} Jersey, Cap & Hoodie Giveaway Nights${ROOT_TEMPLATE}`,
    description: `Every ${YEAR} jersey, cap, and apparel giveaway across pro sports. First 10,000 to 25,000 fans only. Arrive early. Updated weekly.`,
  },
  {
    url: `${BASE}/promos/theme-nights`,
    title: `${YEAR} Theme Nights: Star Wars, Heritage & Fireworks${ROOT_TEMPLATE}`,
    description: `Every ${YEAR} theme night across pro sports by category: Star Wars, heritage, fireworks, faith and community, and pop culture tie-ins. Updated weekly.`,
  },
];

function findDuplicates(
  pages: PageMeta[],
  field: 'title' | 'description',
): Map<string, string[]> {
  const byValue = new Map<string, string[]>();
  for (const p of pages) {
    const key = p[field];
    const list = byValue.get(key) ?? [];
    list.push(p.url);
    byValue.set(key, list);
  }
  const dupes = new Map<string, string[]>();
  for (const [value, urls] of byValue) {
    if (urls.length > 1) dupes.set(value, urls);
  }
  return dupes;
}

async function main() {
  const teams = await getAllTeams();
  console.log(`Fetched ${teams.length} teams`);

  const teamPages = await Promise.all(teams.map(teamMeta));
  const allPages = [...STATIC_PAGES, ...teamPages];

  console.log(
    `\nChecking ${allPages.length} URLs (${STATIC_PAGES.length} static + ${teamPages.length} team)...`,
  );

  const titleDupes = findDuplicates(allPages, 'title');
  const descDupes = findDuplicates(allPages, 'description');

  if (titleDupes.size === 0 && descDupes.size === 0) {
    console.log(
      `\n✓ No duplicate titles. ✓ No duplicate descriptions. (${allPages.length} unique)`,
    );
    return;
  }

  if (titleDupes.size > 0) {
    console.error(`\n✗ ${titleDupes.size} duplicate title group(s):`);
    for (const [title, urls] of titleDupes) {
      console.error(`  TITLE: ${title}`);
      for (const u of urls) console.error(`    - ${u}`);
    }
  }
  if (descDupes.size > 0) {
    console.error(`\n✗ ${descDupes.size} duplicate description group(s):`);
    for (const [desc, urls] of descDupes) {
      console.error(`  DESC: ${desc}`);
      for (const u of urls) console.error(`    - ${u}`);
    }
  }
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
