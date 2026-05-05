/* eslint-disable no-console */
/**
 * Audit-only companion to check-metadata-dedupe.ts.
 *
 * Enumerates all 178 URLs and prints (url, title, char_count, status) sorted
 * by character count desc. Also tests several proposed shortened title
 * templates for team pages and reports their lengths plus uniqueness.
 *
 * Run with:
 *   node --require ./scripts/stub-server-only.cjs --import tsx \
 *     --env-file=.env.local scripts/audit-title-lengths.ts
 */
import { getAllTeams, getTeamPromos, getVenueForTeam } from '../src/lib/data';
import { teamDisplayName } from '../src/lib/promo-helpers';
import type { Team } from '../src/lib/types';

const YEAR = new Date().getFullYear();
const BASE = 'https://www.getpromonight.com';
const ROOT_TEMPLATE = ' | PromoNight';
const TARGET = 65;
const HARD_CAP = 70;

interface PageMeta {
  url: string;
  template: string;
  title: string;
  description: string;
}

async function teamMetaCurrent(team: Team): Promise<PageMeta> {
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
  const display = teamDisplayName(team);
  // Next.js applies layout.tsx's title.template (" | PromoNight") to every
  // child page that returns a string title. We append it here so the audit
  // reports the final rendered HTML title length, not the bare metadata field.
  const title = `${display} Promo Schedule ${YEAR}${ROOT_TEMPLATE}`;
  const description = `All ${YEAR} ${display} ${team.league} promo nights${venueClause}: ${plural(giveaways, 'giveaway')}, ${plural(themes, 'theme night')}, ${plural(kids, 'kids day')}, and ${plural(food, 'food deal')}. Updated weekly.`;
  return {
    url: `${BASE}/${team.sportSlug}/${team.id}`,
    template: 'team',
    title,
    description,
  };
}

const HOMEPAGE_TITLE =
  'PromoNight: Pro Sports Giveaways, Theme Nights & Food Deals';
const HOMEPAGE_DESCRIPTION =
  'PromoNight tracks every giveaway, theme night, and food deal across 167 teams in MLB, NBA, NFL, NHL, MLS, and WNBA. Never miss bobblehead night.';

const STATIC_PAGES: PageMeta[] = [
  {
    url: `${BASE}/`,
    template: 'homepage',
    title: HOMEPAGE_TITLE,
    description: HOMEPAGE_DESCRIPTION,
  },
  {
    url: `${BASE}/teams`,
    template: 'teams-index',
    title: 'All 167 Pro Sports Teams: Promo Calendars by League' + ROOT_TEMPLATE,
    description:
      '167 pro sports teams across MLB, NBA, NFL, NHL, MLS, and WNBA. Giveaways, theme nights, food deals, and kids days in one team directory.',
  },
  {
    url: `${BASE}/playoffs`,
    template: 'playoffs',
    title: '2026 NBA & NHL Playoff Giveaways & Watch Parties' + ROOT_TEMPLATE,
    description:
      'Every 2026 NBA and NHL playoff promotion: rally towels, T-shirt giveaways, watch parties, and fan events at active teams. Updated hourly from official sources.',
  },
  {
    url: `${BASE}/about`,
    template: 'about',
    title: 'About PromoNight: The Indie App Behind the Promo Calendar',
    description:
      'Independent app built by a Minnesota sports fan who kept missing the good games. Free, not affiliated with any league. A cleaner way to browse promos.',
  },
  {
    url: `${BASE}/download`,
    template: 'download',
    title: 'Download PromoNight: Free on iOS & Android',
    description:
      "Install PromoNight free on iOS or Android. Push alerts on every giveaway, theme night, and food deal at your team's home games.",
  },
  {
    url: `${BASE}/privacy`,
    template: 'privacy',
    title: "Privacy Policy: What We Collect and How It's Used" + ROOT_TEMPLATE,
    description:
      'PromoNight privacy policy: what we collect on web and mobile, third-party services (analytics, affiliate networks, ads), and how to opt out.',
  },
  {
    url: `${BASE}/terms`,
    template: 'terms',
    title: 'Terms of Service: Usage Rules and Disclaimers' + ROOT_TEMPLATE,
    description:
      'The rules for using PromoNight: as-is service, data accuracy disclaimers, subscription terms for PromoNight Pro, and the usual liability boilerplate.',
  },
  {
    url: `${BASE}/promos/this-week`,
    template: 'this-week',
    title: 'Promos This Week: 7-Day Giveaway Tracker' + ROOT_TEMPLATE,
    description:
      'Every promo across MLB, NBA, NHL, NFL, MLS, and WNBA in the next 7 days. Bobbleheads, jerseys, theme nights, food deals. Updated daily.',
  },
  {
    url: `${BASE}/promos/bobbleheads`,
    template: 'bobbleheads',
    title: `${YEAR} Bobblehead Giveaways: Player Figurine Nights${ROOT_TEMPLATE}`,
    description: `Every ${YEAR} bobblehead giveaway across MLB, NBA, NHL, NFL, MLS, and WNBA. Player figurines by month with team, date, and opponent. Updated weekly.`,
  },
  {
    url: `${BASE}/promos/jersey-giveaways`,
    template: 'jersey-giveaways',
    title: `${YEAR} Jersey, Cap & Hoodie Giveaway Nights${ROOT_TEMPLATE}`,
    description: `Every ${YEAR} jersey, cap, and apparel giveaway across pro sports. First 10,000 to 25,000 fans only. Arrive early. Updated weekly.`,
  },
  {
    url: `${BASE}/promos/theme-nights`,
    template: 'theme-nights',
    title: `${YEAR} Theme Nights: Star Wars, Heritage & Fireworks${ROOT_TEMPLATE}`,
    description: `Every ${YEAR} theme night across pro sports by category: Star Wars, heritage, fireworks, faith and community, and pop culture tie-ins. Updated weekly.`,
  },
];

function pad(s: string, n: number): string {
  if (s.length >= n) return s;
  return s + ' '.repeat(n - s.length);
}

function teamProposalA(display: string): string {
  return `${display} ${YEAR} Promotions & Giveaways${ROOT_TEMPLATE}`;
}
function teamProposalB(display: string): string {
  return `${display} Promo Schedule ${YEAR}${ROOT_TEMPLATE}`;
}
function teamProposalC(display: string): string {
  return `${display} ${YEAR} Giveaways & Promo Nights`;
}
function teamProposalD(display: string, league: string): string {
  return `${display} ${YEAR} ${league} Promo Schedule${ROOT_TEMPLATE}`;
}

async function main() {
  const teams = await getAllTeams();
  const teamPages = await Promise.all(teams.map(teamMetaCurrent));
  const allPages = [...STATIC_PAGES, ...teamPages];

  console.log(`\n=== AUDIT: ${allPages.length} URLs vs Bing 70-char limit ===\n`);
  const overHard = allPages.filter((p) => p.title.length > HARD_CAP);
  const overTarget = allPages.filter((p) => p.title.length > TARGET);
  console.log(`Total pages:        ${allPages.length}`);
  console.log(`Over ${HARD_CAP} chars (hard): ${overHard.length}`);
  console.log(`Over ${TARGET} chars (target):${overTarget.length}`);
  const longest = [...allPages].sort((a, b) => b.title.length - a.title.length)[0];
  console.log(`Longest:            ${longest.title.length} chars`);
  console.log(`  url:   ${longest.url}`);
  console.log(`  title: ${longest.title}`);

  console.log(`\n=== TOP 20 LONGEST CURRENT TITLES ===`);
  const sorted = [...allPages].sort((a, b) => b.title.length - a.title.length).slice(0, 20);
  console.log(`${pad('len', 4)} ${pad('tmpl', 18)} url`);
  console.log(`${'-'.repeat(4)} ${'-'.repeat(18)} ${'-'.repeat(60)}`);
  for (const p of sorted) {
    console.log(`${pad(String(p.title.length), 4)} ${pad(p.template, 18)} ${p.url}`);
    console.log(`     ${pad('', 18)}   "${p.title}"`);
  }

  console.log(`\n=== STATIC PAGE LENGTHS (current) ===`);
  for (const p of STATIC_PAGES) {
    const flag = p.title.length > HARD_CAP ? 'OVER70' : p.title.length > TARGET ? 'over65' : 'ok';
    console.log(`  ${pad(String(p.title.length), 4)} [${flag}] ${pad(p.template, 18)} ${p.title}`);
  }

  console.log(`\n=== SAMPLE TEAM TITLES (current) ===`);
  const samples = [
    'minnesota-twins',
    'new-york-yankees',
    'los-angeles-dodgers',
    'san-francisco-giants',
    'minnesota-timberwolves',
    'minnesota-wild',
    'new-york-liberty',
    'inter-miami-cf',
  ];
  for (const slug of samples) {
    const t = teams.find((tm) => tm.id === slug);
    if (!t) {
      console.log(`  (not found: ${slug})`);
      continue;
    }
    const display = teamDisplayName(t);
    const current = `${display} ${YEAR} Promo Schedule: Giveaways, Theme Nights & Deals${ROOT_TEMPLATE}`;
    console.log(`  ${pad(String(current.length), 4)} ${current}`);
  }

  console.log(`\n=== TEAM PROPOSAL A: "{Display} ${YEAR} Promotions & Giveaways | PromoNight" ===`);
  let maxA = 0,
    overA = 0;
  const titlesA: string[] = [];
  for (const t of teams) {
    const display = teamDisplayName(t);
    const tt = teamProposalA(display);
    titlesA.push(tt);
    if (tt.length > maxA) maxA = tt.length;
    if (tt.length > HARD_CAP) overA++;
  }
  console.log(`  longest: ${maxA} chars   over70: ${overA} of ${teams.length}`);
  console.log(`  unique:  ${new Set(titlesA).size} of ${titlesA.length}`);
  for (const slug of samples) {
    const t = teams.find((tm) => tm.id === slug);
    if (!t) continue;
    const display = teamDisplayName(t);
    const tt = teamProposalA(display);
    console.log(`    ${pad(String(tt.length), 3)} ${tt}`);
  }

  console.log(`\n=== TEAM PROPOSAL B: "{Display} Promo Schedule ${YEAR} | PromoNight" ===`);
  let maxB = 0,
    overB = 0;
  const titlesB: string[] = [];
  for (const t of teams) {
    const display = teamDisplayName(t);
    const tt = teamProposalB(display);
    titlesB.push(tt);
    if (tt.length > maxB) maxB = tt.length;
    if (tt.length > HARD_CAP) overB++;
  }
  console.log(`  longest: ${maxB} chars   over70: ${overB} of ${teams.length}`);
  console.log(`  unique:  ${new Set(titlesB).size} of ${titlesB.length}`);
  for (const slug of samples) {
    const t = teams.find((tm) => tm.id === slug);
    if (!t) continue;
    const display = teamDisplayName(t);
    const tt = teamProposalB(display);
    console.log(`    ${pad(String(tt.length), 3)} ${tt}`);
  }

  console.log(`\n=== TEAM PROPOSAL C: "{Display} ${YEAR} Giveaways & Promo Nights" (no brand) ===`);
  let maxC = 0,
    overC = 0;
  const titlesC: string[] = [];
  for (const t of teams) {
    const display = teamDisplayName(t);
    const tt = teamProposalC(display);
    titlesC.push(tt);
    if (tt.length > maxC) maxC = tt.length;
    if (tt.length > HARD_CAP) overC++;
  }
  console.log(`  longest: ${maxC} chars   over70: ${overC} of ${teams.length}`);
  console.log(`  unique:  ${new Set(titlesC).size} of ${titlesC.length}`);
  for (const slug of samples) {
    const t = teams.find((tm) => tm.id === slug);
    if (!t) continue;
    const display = teamDisplayName(t);
    const tt = teamProposalC(display);
    console.log(`    ${pad(String(tt.length), 3)} ${tt}`);
  }

  console.log(`\n=== TEAM PROPOSAL D: "{Display} ${YEAR} {League} Promo Schedule | PromoNight" ===`);
  let maxD = 0,
    overD = 0;
  const titlesD: string[] = [];
  for (const t of teams) {
    const display = teamDisplayName(t);
    const tt = teamProposalD(display, t.league);
    titlesD.push(tt);
    if (tt.length > maxD) maxD = tt.length;
    if (tt.length > HARD_CAP) overD++;
  }
  console.log(`  longest: ${maxD} chars   over70: ${overD} of ${teams.length}`);
  console.log(`  unique:  ${new Set(titlesD).size} of ${titlesD.length}`);
  for (const slug of samples) {
    const t = teams.find((tm) => tm.id === slug);
    if (!t) continue;
    const display = teamDisplayName(t);
    const tt = teamProposalD(display, t.league);
    console.log(`    ${pad(String(tt.length), 3)} ${tt}`);
  }

  // Find longest team display names so we know the worst case for any
  // proposal.
  console.log(`\n=== LONGEST TEAM DISPLAY NAMES ===`);
  const byLen = teams
    .map((t) => ({ t, display: teamDisplayName(t), len: teamDisplayName(t).length }))
    .sort((a, b) => b.len - a.len)
    .slice(0, 10);
  for (const { t, display, len } of byLen) {
    console.log(`  ${pad(String(len), 3)} ${pad(t.league, 5)} ${display}`);
  }

  // Description audit
  console.log(`\n=== DESCRIPTION LENGTH AUDIT (Bing recommends ~160) ===`);
  const overDesc160 = allPages.filter((p) => p.description.length > 160);
  const overDesc170 = allPages.filter((p) => p.description.length > 170);
  console.log(`Over 160 chars: ${overDesc160.length} of ${allPages.length}`);
  console.log(`Over 170 chars: ${overDesc170.length} of ${allPages.length}`);
  const longestDescs = [...allPages].sort((a, b) => b.description.length - a.description.length).slice(0, 12);
  for (const p of longestDescs) {
    console.log(`  ${pad(String(p.description.length), 4)} ${p.url}`);
  }

  // Per-template breakdown
  console.log(`\n=== PER-TEMPLATE BREAKDOWN (current) ===`);
  const byTemplate = new Map<string, PageMeta[]>();
  for (const p of allPages) {
    const arr = byTemplate.get(p.template) ?? [];
    arr.push(p);
    byTemplate.set(p.template, arr);
  }
  for (const [tmpl, arr] of byTemplate) {
    const lens = arr.map((p) => p.title.length);
    const min = Math.min(...lens);
    const max = Math.max(...lens);
    const over = arr.filter((p) => p.title.length > HARD_CAP).length;
    console.log(
      `  ${pad(tmpl, 18)} count=${pad(String(arr.length), 3)} min=${pad(String(min), 3)} max=${pad(String(max), 3)} over70=${over}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
