import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { pageOpenGraph } from '@/lib/og';
// Shared Barlow Condensed instance (600/700/800). Importing it here adds its
// preloads to THIS route only; the font module's own import-graph warning is
// satisfied because this page renders the face throughout.
import { barlowCondensed } from '@/components/cfb/rivalry/fonts';
import {
  BAG_SEASON,
  groupBagPolicyRows,
  deriveBagStats,
  buildBagPolicyFaqs,
  buildBagPolicyPageCopy,
  clutchChipFor,
  type BagPolicyGroup,
  type BagPolicyRow,
} from '@/lib/venue-bag-policies';
import { getMlbBagPolicyRows } from '@/lib/venue-bag-policies-data';
import { buildBagPolicyJsonLd } from '@/lib/venue-bag-jsonld';

// SSG + ISR at the /venues index cadence; on-demand revalidation is the real
// freshness path after a pipeline data pass.
export const revalidate = 86400;

const CANONICAL = 'https://www.getpromonight.com/venues/bag-policies';
const CONDENSED = 'var(--font-cfb-condensed), var(--font-rd, system-ui), sans-serif';
// Mockup accent roles translated onto site tokens: base colors are the site's
// (rd-cream page, rd-card cards, rd-ink text, rd-line borders, rd-red for red
// roles); the mockup governs only the new badge/chip accents below.
const GOLD = '#a87718';
const OK = '#2e7d54';
const BADGE_STYLE: Record<BagPolicyGroup['badge'], { color: string; bg: string }> = {
  strict: { color: 'var(--color-rd-red)', bg: 'rgba(218, 45, 32, 0.08)' },
  warn: { color: GOLD, bg: 'rgba(168, 119, 24, 0.10)' },
  ok: { color: OK, bg: 'rgba(46, 125, 84, 0.10)' },
  neutral: { color: 'var(--color-rd-ink-soft)', bg: 'rgba(33, 29, 24, 0.06)' },
};

export async function generateMetadata(): Promise<Metadata> {
  // Same computation the DOM renders: no literal counts anywhere in the head.
  const groups = groupBagPolicyRows(await getMlbBagPolicyRows());
  const s = deriveBagStats(groups);
  const { title, description } = buildBagPolicyPageCopy(s);
  return {
    title,
    description,
    alternates: { canonical: CANONICAL },
    openGraph: pageOpenGraph('/venues/bag-policies'),
  };
}

function gamesCount(n: number): string {
  return `${n} ${n === 1 ? 'park' : 'parks'}`;
}

function Chip({ k, v, tone }: { k: string; v: string; tone?: 'gold' | 'dashed' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
        tone === 'dashed' ? 'border-dashed border-rd-line-strong bg-transparent' : 'border-rd-line bg-rd-cream'
      }`}
    >
      <span className="text-[10px] uppercase tracking-[0.08em] text-rd-ink-faint">{k}</span>
      <span
        className={`font-semibold tabular-nums ${tone === 'dashed' ? 'font-medium text-rd-ink-soft' : 'text-rd-ink'}`}
        style={tone === 'gold' ? { color: GOLD } : undefined}
      >
        {v}
      </span>
    </span>
  );
}

// Chips per group, from data the row affirmatively carries. Null is never
// "No": a missing verdict or size renders nothing, and only the dashed chip
// marks a confirmed allowance whose size is not confirmed.
function rowChips(group: BagPolicyGroup['key'], r: BagPolicyRow) {
  const chips: ReactNode[] = [];
  if (r.sourcesConflict) {
    // HARD RULE row (kauffman): pointer only, policy host, no sizes, no verdict.
    chips.push(<Chip key="confirm" k="Bag policy" v="confirm with the venue" tone="dashed" />);
    if (r.bagPolicyUrl) {
      chips.push(<Chip key="policy" k="Policy" v={new URL(r.bagPolicyUrl).hostname.replace(/^www\./, '')} tone="dashed" />);
    }
    return chips;
  }
  if (group === 'no-bags') {
    // The stored cap is the CLUTCH cap; an ordinary max-bag label would imply
    // a bag allowance the park does not offer.
    if (r.dimsText) chips.push(<Chip key="clutch" k="Clutch" v={`up to ${r.dimsText}`} tone="gold" />);
    return chips;
  }
  if (group === 'clear-required' && r.dimsText) chips.push(<Chip key="clear" k="Clear bag" v={r.dimsText} />);
  if ((group === 'size-limited' || group === 'check-policy') && r.dimsText) {
    chips.push(<Chip key="max" k="Max bag" v={r.dimsText} />);
  }
  // Group-aware: an unsized affirmation renders only under a clear-bag
  // requirement, where a clutch exception is definitionally separate; the
  // dashed copy points without asserting a published size.
  const clutch = clutchChipFor(group, r.clutch);
  if (clutch?.kind === 'sized') chips.push(<Chip key="clutch" k="Clutch" v={clutch.text} tone="gold" />);
  else if (clutch?.kind === 'affirmed') chips.push(<Chip key="clutch" k="Clutch" v="allowed, see official policy" tone="dashed" />);
  return chips;
}

function VenueRow({ group, r }: { group: BagPolicyGroup['key']; r: BagPolicyRow }) {
  const chips = rowChips(group, r);
  return (
    <li>
      <Link
        href={`/venues/${r.slug}`}
        className={`relative block overflow-hidden rounded-[10px] border bg-rd-card shadow-sm transition-[transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow-md ${
          r.sourcesConflict ? 'border-dashed border-rd-line-strong' : 'border-rd-line'
        }`}
      >
        <span aria-hidden className="absolute inset-y-0 left-0 w-[4px]" style={{ background: r.teamColor ?? 'var(--color-rd-line)' }} />
        <span className="block py-3 pl-5 pr-3.5">
          <span className="flex items-baseline justify-between gap-3">
            <span className="min-w-0">
              <span className="block text-[19px] font-bold uppercase leading-[1.1] tracking-[0.02em] text-rd-ink" style={{ fontFamily: CONDENSED }}>
                {r.venueName}
              </span>
              <span className="mt-px block text-[12.5px] text-rd-ink-soft">{r.teamName}</span>
            </span>
            <span aria-hidden className="shrink-0 text-[15px] text-rd-ink-decor">→</span>
          </span>
          {chips.length > 0 && <span className="mt-2 flex flex-wrap gap-1.5">{chips}</span>}
        </span>
      </Link>
    </li>
  );
}

export default async function Page() {
  const rows = await getMlbBagPolicyRows();
  // ONE computation: the DOM groups, the glance stats, the group headers, the
  // FAQ and the ItemList all read this. Flattened group order IS the ItemList
  // order.
  const groups = groupBagPolicyRows(rows);
  const stats = deriveBagStats(groups);
  const faqs = buildBagPolicyFaqs(groups);
  const orderedRows = groups.flatMap((g) => g.rows);
  const { title, description } = buildBagPolicyPageCopy(stats);
  const schemas = buildBagPolicyJsonLd(title, description, orderedRows, faqs);

  return (
    <div className={`rd-root min-h-screen bg-rd-cream ${barlowCondensed.variable}`}>
      {schemas.map((schema, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}
      <div className="mx-auto max-w-2xl px-4 pb-20 pt-9">
        <nav aria-label="Breadcrumb">
          <Link
            href="/venues"
            className="text-[13px] font-semibold uppercase tracking-[0.18em] text-rd-red transition-colors hover:text-rd-red-dark"
            style={{ fontFamily: CONDENSED }}
          >
            Stadium Guides
          </Link>
        </nav>
        <h1
          className="mt-1.5 font-extrabold uppercase leading-[0.98] text-rd-ink"
          style={{ fontFamily: CONDENSED, fontSize: 'clamp(38px, 9vw, 54px)' }}
        >
          MLB Bag Policy <span className="text-rd-red">{BAG_SEASON}</span>
        </h1>
        <p className="mt-2.5 max-w-[48ch] text-[15px] text-rd-ink-soft">
          What you can carry into every ballpark: clear bag rules, size limits and the small-clutch exception, compared side by side.
        </p>
        {/* Direct-answer capsule (mockup), counts derived. */}
        <div className="mt-5 rounded-lg border border-rd-line bg-rd-card p-4 text-[14.5px] text-rd-ink" style={{ borderLeft: '3px solid var(--color-rd-red)' }}>
          {stats.clearRequired + stats.noBags} of the {stats.total} parks require a clear bag or keep bags out entirely, and{' '}
          {stats.sizeLimited} more cap the size. Rules vary by park, so check your stadium below before you pack.
        </div>

        {/* At a glance: one stat per rendered group, same computation. */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {stats.perGroup.map((g) => (
            <div key={g.key} className="rounded-lg border border-rd-line bg-rd-card px-2.5 py-3 text-center shadow-sm">
              <div className="text-[30px] font-extrabold leading-none" style={{ fontFamily: CONDENSED, color: BADGE_STYLE[g.badge].color }}>
                {g.count}
              </div>
              <div className="mt-1 text-[10.5px] uppercase leading-tight tracking-[0.06em] text-rd-ink-faint">{g.title}</div>
            </div>
          ))}
        </div>

        {groups.map((g) => (
          <section key={g.key} className="mt-9">
            {/* Sticky at top-14: the global BrandBar is itself sticky (h-14). */}
            <div className="sticky top-14 z-10 pb-2 pt-3" style={{ background: 'linear-gradient(var(--color-rd-cream) 84%, transparent)' }}>
              <div className="flex items-center gap-2.5">
                <span
                  className="rounded px-2 py-0.5 text-[11px] font-bold tracking-[0.1em] uppercase"
                  style={{ color: BADGE_STYLE[g.badge].color, background: BADGE_STYLE[g.badge].bg }}
                >
                  {g.title}
                </span>
                <span className="ml-auto text-[15px] font-semibold tracking-[0.06em] text-rd-ink-faint" style={{ fontFamily: CONDENSED }}>
                  {gamesCount(g.rows.length)}
                </span>
              </div>
            </div>
            <p className="mb-3 mt-0.5 text-[13px] text-rd-ink-faint">{g.sub}</p>
            <ul className="space-y-2">
              {g.rows.map((r) => (
                <VenueRow key={r.slug} group={g.key} r={r} />
              ))}
            </ul>
          </section>
        ))}

        {faqs.length > 0 && (
          <section className="mt-12">
            <h2
              className="border-b-2 border-rd-line pb-2.5 text-[26px] font-extrabold uppercase text-rd-ink"
              style={{ fontFamily: CONDENSED }}
            >
              Frequently asked questions
            </h2>
            <div className="mt-4 space-y-4.5">
              {faqs.map((f) => (
                <div key={f.question} className="mb-4">
                  <h3 className="text-[18px] font-bold text-rd-ink" style={{ fontFamily: CONDENSED }}>
                    {f.question}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-rd-ink-soft">{f.answer}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <p className="mt-9 text-xs text-rd-ink-faint">
          Policies checked against each ballpark&apos;s official published policy. Tap any park for its full gameday guide.
        </p>
      </div>
    </div>
  );
}
