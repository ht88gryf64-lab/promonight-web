/* eslint-disable no-console */
/**
 * CTR diagnostic, Phase 0. READ ONLY. Changes nothing.
 *
 * Emits, for 30 MLB team pages and 7 venue pages:
 *   served:  <title>, meta description, og:title, H1, every H2/H3, FAQPage questions
 *   source:  the title/description generateMetadata would produce right now
 *   diff:    where served differs from source
 *
 * Network budget: 1 revalidate POST (batched, up to 100 paths) + 37 GETs = 38.
 * Phase 0 ceiling is 40. Query-string cache-busting does not work on this host,
 * which is why the batched on-demand revalidate runs first.
 *
 * The team title/description block below is a deliberate MIRROR of
 * src/app/[sport]/[team]/page.tsx generateMetadata. A mirror can drift, so the
 * script validates itself: every served-vs-source mismatch is reported rather
 * than assumed away. (check-metadata-dedupe.ts and audit-title-lengths.ts are
 * older mirrors that HAVE drifted; see the Gate 0 report.)
 *
 * Run with:
 *   node --require ./scripts/stub-server-only.cjs --import tsx \
 *     --env-file=.env.local audit/ctr-phase0-audit.ts
 */
import { getAllTeams, getTeamPromos, getVenueForTeam } from '../src/lib/data';
import { getVenueHub, venueHubTitle, venueHubDescription, venueHubIsIndexable } from '../src/lib/venue-hub';
import { teamDisplayName, isUpcomingPromo } from '../src/lib/promo-helpers';
import type { Team } from '../src/lib/types';

const BASE = 'https://www.getpromonight.com';
const ROOT_TEMPLATE = ' | PromoNight';
const VENUE_SLUGS = [
  'busch-stadium',
  'guaranteed-rate-field',
  'citi-field',
  'truist-park',
  'coors-field',
  'wrigley-field',
  'daikin-park',
];

// ── source-side mirror of the team generateMetadata ────────────────────────
function truncateAtWord(s: string, max: number): string {
  if (s.length <= max) return s;
  const slice = s.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  return (lastSpace > 0 ? slice.slice(0, lastSpace) : slice).trimEnd();
}

async function teamSourceMeta(team: Team) {
  const [venue, promos] = await Promise.all([
    getVenueForTeam(team.id),
    getTeamPromos(team.id),
  ]);
  const year = 2026;
  const displayName = teamDisplayName(team);
  const title = `${displayName} Promos & Giveaways ${year}`;
  const DESC_MAX = 160;
  const todayStr = new Date().toISOString().split('T')[0];
  const monthDay = (d: string) =>
    new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const freshnessTail = ['MLB', 'WNBA', 'MLS', 'NHL'].includes(team.league)
    ? 'Rechecked weekly in season.'
    : 'From official team announcements.';
  const fallbackDescription = venue
    ? `${displayName} ${year} promotional schedule - bobbleheads, giveaways, theme nights, and food deals at ${venue.name}. ${freshnessTail}`
    : `${displayName} ${year} promotional schedule - bobbleheads, giveaways, theme nights, and food deals. ${freshnessTail}`;
  const upcomingForDesc = promos
    .filter((p) => isUpcomingPromo(p, todayStr))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);
  let rawDescription = fallbackDescription;
  if (upcomingForDesc.length > 0) {
    const prefix = `Upcoming ${displayName} promos: `;
    const closer = ` See the full ${year} schedule at PromoNight.`;
    const fits: string[] = [];
    let len = prefix.length;
    for (const p of upcomingForDesc) {
      const entry = `${monthDay(p.date)} - ${p.title}`;
      const sep = fits.length === 0 ? '' : ', ';
      if (len + sep.length + entry.length + 1 > DESC_MAX) break;
      fits.push(entry);
      len += sep.length + entry.length;
    }
    if (fits.length > 0) {
      const listBody = `${prefix}${fits.join(', ')}.`;
      rawDescription = (listBody + closer).length <= DESC_MAX ? listBody + closer : listBody;
    }
  }
  const allUpcoming = promos.filter((p) => isUpcomingPromo(p, todayStr));
  return {
    renderedTitle: title + ROOT_TEMPLATE,
    description: truncateAtWord(rawDescription, DESC_MAX),
    upcomingTotal: allUpcoming.length,
    upcomingTheme: allUpcoming.filter((p) => p.type === 'theme').length,
    upcomingGiveaway: allUpcoming.filter((p) => p.type === 'giveaway' || p.isGiveaway).length,
    nextGiveaway: allUpcoming
      .filter((p) => p.type === 'giveaway' || p.isGiveaway)
      .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null,
    venueName: venue?.name ?? null,
  };
}

// ── HTML extraction ────────────────────────────────────────────────────────
const strip = (s: string) =>
  s.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'")
   .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
   .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

function extract(html: string) {
  const title = strip((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) ?? [])[1] ?? '');
  const desc = (html.match(/<meta name="description" content="([^"]*)"/i) ?? [])[1] ?? '';
  const ogTitle = (html.match(/<meta property="og:title" content="([^"]*)"/i) ?? [])[1] ?? '';
  const robots = (html.match(/<meta name="robots" content="([^"]*)"/i) ?? [])[1] ?? '';
  const canonical = (html.match(/<link rel="canonical" href="([^"]*)"/i) ?? [])[1] ?? '';
  const h1 = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => strip(m[1])).filter(Boolean);
  const h2 = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) => strip(m[1])).filter(Boolean);
  const h3 = [...html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi)].map((m) => strip(m[1])).filter(Boolean);

  const jsonldRaw = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  const types: string[] = [];
  const faqQuestions: string[] = [];
  let jsonldParseErrors = 0;
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== 'object') return;
    const o = node as Record<string, unknown>;
    if (typeof o['@type'] === 'string') types.push(o['@type'] as string);
    if (Array.isArray(o['@type'])) (o['@type'] as string[]).forEach((t) => types.push(t));
    if (o['@type'] === 'Question' && typeof o.name === 'string') faqQuestions.push(o.name);
    Object.values(o).forEach(walk);
  };
  for (const raw of jsonldRaw) {
    try { walk(JSON.parse(raw)); } catch { jsonldParseErrors++; }
  }
  return { title, desc, ogTitle, robots, canonical, h1, h2, h3, types, faqQuestions, jsonldParseErrors, blocks: jsonldRaw.length, bytes: html.length };
}

// ── main ───────────────────────────────────────────────────────────────────
async function main() {
  const teams = (await getAllTeams()).filter((t) => t.league === 'MLB');
  teams.sort((a, b) => a.id.localeCompare(b.id));
  console.log(`MLB teams found: ${teams.length}`);

  const teamPaths = teams.map((t) => `/${t.sportSlug}/${t.id}`);
  const venuePaths = VENUE_SLUGS.map((s) => `/venues/${s}`);
  const allPaths = [...teamPaths, ...venuePaths];

  // 1 request: batched on-demand revalidate.
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) throw new Error('REVALIDATE_SECRET missing from env');
  const rv = await fetch(`${BASE}/api/revalidate`, {
    method: 'POST',
    headers: { 'x-revalidate-secret': secret, 'content-type': 'application/json' },
    body: JSON.stringify({ paths: allPaths }),
  });
  console.log(`revalidate: HTTP ${rv.status} ${await rv.text()}`);
  console.log(`REQUESTS USED so far: 1 (of 40)`);

  // 37 requests: serial GETs so the ISR regeneration has settled per path.
  const rows: Record<string, unknown>[] = [];
  let used = 1;
  for (const p of allPaths) {
    const res = await fetch(`${BASE}${p}`, { headers: { 'user-agent': 'promonight-ctr-audit/1.0' } });
    used++;
    const html = await res.text();
    rows.push({ path: p, status: res.status, cache: res.headers.get('x-vercel-cache'), ...extract(html) });
  }
  console.log(`REQUESTS USED total: ${used} (of 40)`);

  // source-side
  const src: Record<string, Awaited<ReturnType<typeof teamSourceMeta>>> = {};
  for (const t of teams) src[`/${t.sportSlug}/${t.id}`] = await teamSourceMeta(t);
  const venueSrc: Record<string, { title: string; description: string; indexable: boolean }> = {};
  for (const s of VENUE_SLUGS) {
    const hub = await getVenueHub(s);
    venueSrc[`/venues/${s}`] = hub
      ? { title: venueHubTitle(hub) + ROOT_TEMPLATE, description: venueHubDescription(hub), indexable: venueHubIsIndexable(hub) }
      : { title: 'HUB NOT FOUND', description: '', indexable: false };
  }

  console.log('\n=====JSON=====');
  console.log(JSON.stringify({ rows, src, venueSrc }, null, 1));
}

main().catch((e) => { console.error(e); process.exit(1); });
