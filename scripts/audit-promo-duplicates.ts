/* eslint-disable no-console */
/**
 * Read-only scan for likely duplicate promo pages, site-wide.
 *
 * A promo page is every promo doc under teams/{teamId}/promos sharing one
 * pageSlug. Two pages are a likely duplicate pair when they belong to the
 * same team and page season, fall on the same or an adjacent date, and their
 * slugs or titles share their distinctive tokens once generic words
 * ("night", "giveaway", "jersey", years) are removed. Typical shapes:
 * "x-night" vs "x-giveaway", "x" vs "x-baseball-jersey", "x" vs "x-2026-27".
 *
 * For each pair it reports whether the two pages share one underlying doc
 * (one doc's previousSlugs names the other page's live slug, so a single
 * record answers at two URLs) or are two docs, plus the facts that decide
 * between "one promo split in two" and "two distinct promos": same game,
 * same source URL, same themeKey, type, ticket-package flag.
 *
 * Writes nothing. Run from the repo root:
 *   node --require ./scripts/stub-server-only.cjs --import tsx \
 *     --env-file=.env.local scripts/audit-promo-duplicates.ts [--json out.json]
 */
import { writeFileSync } from 'node:fs';
import { db } from '../src/lib/firebase';
import { getAllTeams } from '../src/lib/data';
import { canonicalSlugFor } from '../src/lib/promo-page-copy';
import { isTicketPackageLeague } from '../src/lib/ticket-packages';

// Words that name the kind of promo, not which promo it is.
const GENERIC = new Set([
  'night', 'nights', 'nite', 'giveaway', 'giveaways', 'game', 'games', 'day', 'celebration', 'theme',
  'the', 'a', 'an', 'and', 'of', 'for', 'presented', 'by', 'fan', 'fans', 'item', 'special', 'with',
  'ticket', 'package', 'pack', 'jersey', 'baseball', 'basketball', 'hockey', 'football', 'soccer',
  'shirt', 'tshirt', 't', 'tee', 'hat', 'cap', 'bobblehead', 'scarf', 'hoodie', 'blanket', 'poster',
  'replica', 'edition', 'event', 'party', 'free', 'first', 'at', 'to', 'in', 'on', 'x', 'vs',
  'vip', 'wnba', 'nba', 'nhl', 'mlb', 'mls', 'nfl',
]);

function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
function tokens(s: string): string[] {
  return norm(s).split(/[^a-z0-9]+/).filter(Boolean);
}
function core(s: string, teamWords: Set<string> = new Set()): Set<string> {
  // Drop generic words, the team's own name words and season/year tokens
  // (2026, 27, 2026-27 suffixes).
  return new Set(tokens(s).filter((t) => !GENERIC.has(t) && !teamWords.has(t) && !/^\d{1,4}$/.test(t)));
}
function overlap(a: Set<string>, b: Set<string>): { shared: string[]; jaccard: number; subset: boolean } {
  const shared = [...a].filter((t) => b.has(t));
  const union = new Set([...a, ...b]).size || 1;
  const subset = a.size > 0 && b.size > 0 && (shared.length === a.size || shared.length === b.size);
  return { shared, jaccard: shared.length / union, subset };
}
function dayDiff(a: string, b: string): number {
  return Math.round(Math.abs(Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86400000);
}
const YMD = /^\d{4}-\d{2}-\d{2}$/;

interface Doc {
  id: string;
  pageSlug: string;
  title: string;
  date: string;
  type: string;
  opponent: string;
  sourceUrl: string;
  themeKey: string;
  pageSeason: string;
  ticketPackageRequired: boolean;
  tombstoned: boolean;
  isPostseason: boolean;
  previousSlugs: string[];
  imageTier: number | null;
}

interface Pair {
  league: string;
  teamId: string;
  sport: string;
  date: string;
  dateB: string;
  slugA: string;
  slugB: string;
  titleA: string;
  titleB: string;
  docsA: string[];
  docsB: string[];
  record: 'same doc (previousSlugs)' | 'two docs';
  sameGame: boolean;
  sameSource: boolean;
  sameThemeKey: boolean;
  types: string;
  ticketPackage: string;
  sharedTokens: string[];
  match: string;
  /** 'same words': both titles (or both slugs) reduce to the same distinctive
   *  words, so they answer the same query. 'one adds a word': one names an
   *  extra item or qualifier the other lacks (e.g. "-backpack"). */
  bucket: 'same words' | 'one adds a word';
  /** What the shipped canonical rule (promo-page-copy.ts canonicalGroups,
   *  ruling 2026-10-29) already does with the pair: 'A->B' / 'B->A' when one
   *  page renders rel=canonical to the other, 'none' otherwise. */
  existingCanonical: string;
}

async function main() {
  const jsonOut = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null;
  const teams = await getAllTeams();
  const pairs: Pair[] = [];
  let docCount = 0;
  let pageCount = 0;

  for (const team of teams) {
    const snap = await db.collection('teams').doc(team.id).collection('promos').get();
    const docs: Doc[] = snap.docs.map((d) => {
      const x = d.data();
      return {
        id: d.id,
        pageSlug: typeof x.pageSlug === 'string' ? x.pageSlug : '',
        title: typeof x.title === 'string' ? x.title : '',
        date: typeof x.date === 'string' ? x.date : '',
        type: String(x.type ?? ''),
        opponent: norm(String(x.opponent ?? '')).replace(/^the /, ''),
        sourceUrl: String(x.sourceUrl ?? ''),
        themeKey: String(x.themeKey ?? ''),
        pageSeason: String(x.pageSeason ?? ''),
        ticketPackageRequired: x.ticketPackageRequired === true,
        tombstoned: x.tombstoned === true,
        isPostseason: x.isPostseason === true,
        previousSlugs: Array.isArray(x.previousSlugs) ? x.previousSlugs.filter((s: unknown) => typeof s === 'string') : [],
        imageTier: typeof x.imageTier === 'number' ? x.imageTier : null,
      };
    });
    docCount += docs.length;
    // Live, dated, slugged rows only: a tombstoned page is already a removed page.
    const live = docs.filter((d) => d.pageSlug && YMD.test(d.date) && !d.tombstoned && !d.isPostseason);
    const bySlug = new Map<string, Doc[]>();
    for (const d of live) bySlug.set(d.pageSlug, [...(bySlug.get(d.pageSlug) ?? []), d]);
    pageCount += bySlug.size;
    const slugs = [...bySlug.keys()];
    const teamWords = new Set(tokens(`${team.id} ${team.name ?? ''}`));
    // The render's candidates (resolvePromoPage): the team's linkable rows on
    // the page's one date. A series page is never a duplicate.
    const linkableRow = (d: Doc) => !(isTicketPackageLeague(team.league) && d.ticketPackageRequired);
    const canonicalOf = (slug: string): string | null => {
      const dates = [...new Set(bySlug.get(slug)!.map((d) => d.date))];
      if (dates.length !== 1) return null;
      const cands = live.filter((d) => d.date === dates[0] && linkableRow(d)).map((d) => ({ pageSlug: d.pageSlug, title: d.title, type: d.type as never, imageTier: d.imageTier as never }));
      return canonicalSlugFor(slug, cands);
    };

    const seen = new Set<string>();
    for (let i = 0; i < slugs.length; i++) {
      for (let j = i + 1; j < slugs.length; j++) {
        const A = bySlug.get(slugs[i])!;
        const B = bySlug.get(slugs[j])!;
        for (const a of A) {
          for (const b of B) {
            if (a.pageSeason !== b.pageSeason) continue;
            const gap = dayDiff(a.date, b.date);
            if (gap > 1) continue;
            const slugO = overlap(core(a.pageSlug, teamWords), core(b.pageSlug, teamWords));
            const titleO = overlap(core(a.title, teamWords), core(b.title, teamWords));
            const best = slugO.shared.length >= titleO.shared.length ? slugO : titleO;
            const themeSame = !!a.themeKey && a.themeKey !== 'none' && a.themeKey === b.themeKey;
            // Same game: one distinctive-word set contains the other, or they
            // share two thirds. Adjacent date: containment only.
            const tokenHit = best.shared.length > 0 && (best.subset || (gap === 0 && best.jaccard >= 0.67));
            if (!tokenHit) continue;
            const key = [slugs[i], slugs[j]].sort().join('|');
            if (seen.has(key)) continue;
            seen.add(key);
            const [first, second] = a.pageSlug < b.pageSlug ? [a, b] : [b, a];
            const [fDocs, sDocs] = a.pageSlug < b.pageSlug ? [A, B] : [B, A];
            const sameDoc = fDocs.some((d) => d.previousSlugs.includes(second.pageSlug)) || sDocs.some((d) => d.previousSlugs.includes(first.pageSlug));
            pairs.push({
              league: team.league,
              teamId: team.id,
              sport: team.sportSlug,
              date: first.date,
              dateB: second.date,
              slugA: first.pageSlug,
              slugB: second.pageSlug,
              titleA: first.title,
              titleB: second.title,
              docsA: fDocs.map((d) => d.id),
              docsB: sDocs.map((d) => d.id),
              record: sameDoc ? 'same doc (previousSlugs)' : 'two docs',
              sameGame: first.date === second.date && !!first.opponent && first.opponent.split(' ').pop() === second.opponent.split(' ').pop(),
              sameSource: !!first.sourceUrl && first.sourceUrl === second.sourceUrl,
              sameThemeKey: themeSame,
              types: `${first.type}/${second.type}`,
              ticketPackage: `${first.ticketPackageRequired ? 'Y' : 'n'}/${second.ticketPackageRequired ? 'Y' : 'n'}`,
              sharedTokens: best.shared,
              match: best.subset ? 'subset' : `jaccard ${best.jaccard.toFixed(2)}`,
              bucket: slugO.jaccard === 1 || titleO.jaccard === 1 ? 'same words' : 'one adds a word',
              existingCanonical: canonicalOf(first.pageSlug) === second.pageSlug ? 'A->B' : canonicalOf(second.pageSlug) === first.pageSlug ? 'B->A' : 'none',
            });
          }
        }
      }
    }
  }

  pairs.sort((x, y) => x.league.localeCompare(y.league) || x.teamId.localeCompare(y.teamId) || x.date.localeCompare(y.date));
  console.log(`teams ${teams.length}, promo docs ${docCount}, live promo pages ${pageCount}, likely duplicate pairs ${pairs.length}\n`);
  const buckets = ['same words', 'one adds a word'] as const;
  for (const b of buckets) {
    const inB = pairs.filter((p) => p.bucket === b);
    console.log(`${b}: ${inB.length} (already canonicalized by the 2026-10-29 rule: ${inB.filter((p) => p.existingCanonical !== 'none').length})`);
  }
  console.log('');
  console.log('| bucket | team | date | slug A | slug B | title A | title B | record | existing canonical | same game | same source | same themeKey | types | ticket pkg |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  pairs.sort((x, y) => buckets.indexOf(x.bucket) - buckets.indexOf(y.bucket));
  for (const p of pairs) {
    const date = p.date === p.dateB ? p.date : `${p.date} / ${p.dateB}`;
    console.log(`| ${p.bucket} | ${p.sport}/${p.teamId} | ${date} | ${p.slugA} | ${p.slugB} | ${p.titleA} | ${p.titleB} | ${p.record} | ${p.existingCanonical} | ${p.sameGame ? 'Y' : 'n'} | ${p.sameSource ? 'Y' : 'n'} | ${p.sameThemeKey ? 'Y' : 'n'} | ${p.types} | ${p.ticketPackage} |`);
  }
  if (jsonOut) writeFileSync(jsonOut, JSON.stringify(pairs, null, 2));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
