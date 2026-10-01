// The cases the byte-identity golden is taken over, shared by the test and by
// scripts/playoffs/byte-identity-golden.tsx, which renders them with the
// code of a given commit. Not a test file. It uses only helpers that existed
// on main before the PromoNight Predicts line, so the golden can be taken
// from main's own code.
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement } from 'react';
import { mapBracketDoc } from '../../../../lib/postseason/map';
import { playoffsLinkState } from '../../../../lib/postseason/gate';
import { buildLeagueView } from '../../../../lib/postseason/view';
import { clubPlayoffs, type InboundLeague } from '../../../../lib/postseason/inbound';
import { FIXTURE, clubs, decidedMlb, decidedWnba, loadDoc, parks } from '../../../../lib/postseason/__tests__/helpers';
import { walk } from '../../../../lib/postseason/__tests__/element-tree';
import { TeamPlayoffsModule } from '../TeamPlayoffsModule';
import { HubHero } from '../../../hub/HubHero';

type Doc = Record<string, unknown>;

/** Each case: a name, the stored documents, and the moment. */
export const CASES: [string, () => Doc[], Date][] = [
  ['wildcard-0017Z', () => [loadDoc(FIXTURE.mlbWildCard), loadDoc(FIXTURE.wnbaLynxOut)], new Date('2026-10-01T00:17:37Z')],
  ['today-1625Z', () => [loadDoc('MLB_2026.live-20261001T1625Z.json'), loadDoc('WNBA_2026.live-20261001T1625Z.json')], new Date('2026-10-01T16:25:27Z')],
  ['decided', () => [decidedMlb(), decidedWnba()], new Date('2026-10-01T16:25:27Z')],
  ['mixed-2025', () => [loadDoc(FIXTURE.mlbMixed), loadDoc(FIXTURE.wnbaMixed)], new Date('2025-10-09T03:08:00Z')],
];

export function inboundOf(docs: Doc[], now: Date): InboundLeague[] {
  const brackets = docs.map((d) => {
    const b = mapBracketDoc(d, { league: d.league as 'MLB' | 'WNBA', season: d.season as number });
    if (!b) throw new Error('bracket does not map');
    return b;
  });
  if (playoffsLinkState(brackets, now).state === 'hidden') return [];
  return brackets.map((b) => {
    const view = buildLeagueView(b, clubs(), parks(), now);
    if (!view) throw new Error('bracket does not build');
    // `bracket` is ignored by code that does not know the field.
    return { league: b.league, href: `/playoffs/${b.league.toLowerCase()}`, view, bracket: b } as InboundLeague;
  });
}

export interface Rendered {
  html: string;
  tree: unknown;
}

function rendered(el: ReactElement): Rendered {
  return { html: renderToStaticMarkup(el), tree: walk(el) };
}

/** Every club's module in every case, keyed "case/club", with no pick. */
export function teamModules(): Record<string, Rendered> {
  const out: Record<string, Rendered> = {};
  for (const [name, docs, now] of CASES) {
    const inbound = inboundOf(docs(), now);
    for (const l of inbound) {
      for (const slug of new Set(l.bracket.series.flatMap((s) => [s.higher, s.lower]).flatMap((x) => (x.kind === 'club' ? [x.slug] : [])))) {
        const club = clubPlayoffs(inbound, slug);
        if (!club) continue;
        const c = clubs().get(slug)!;
        out[`${name}/${slug}`] = rendered(<TeamPlayoffsModule club={club} teamId={slug} teamName={c.name} />);
      }
    }
  }
  return out;
}

/** A hub hero as every hub without a playoffs line renders it. */
export function heroes(): Record<string, Rendered> {
  return {
    'full': rendered(
      <HubHero eyebrow="MLB League Hub" title="MLB PROMOTIONS 2026" subtitle="Sub" freshness="Fresh" accent="#7c4a3a">
        <div data-stats>stats</div>
      </HubHero>,
    ),
    'bare': rendered(<HubHero eyebrow="NFL League Hub" title="NFL PROMOTIONS 2026" />),
  };
}
