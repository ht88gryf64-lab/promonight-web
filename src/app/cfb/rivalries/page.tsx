import type { Metadata } from 'next';
import Link from 'next/link';
import { getMatchupIndexRows } from '@/lib/cfb/matchups';
import { buildCfbRivalryIndexMetadata } from '@/lib/cfb/metadata';
import {
  orderedIndexRows,
  rivalryWeekRows,
  buildRivalryIndexFaqs,
  type RivalryIndexRow,
} from '@/lib/cfb/rivalry-index';
import { buildRivalryIndexJsonLd } from '@/lib/cfb/rivalry-jsonld';

export const revalidate = 21600; // ISR, same cadence as the CFB hub

// Hardcoded season year by house rule: never getFullYear() in SEO copy, bump
// deliberately when next-season content is ready. Moved into the shared builder
// so this page picks up the canonical and self-referencing og:url it shipped
// without; the title and description are unchanged.
export const metadata: Metadata = buildCfbRivalryIndexMetadata();

function monthDay(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Full-card row (the <Link> IS the card), shared by the Rivalry Week section
// and the full list so the two can never render a rivalry differently.
function RivalryRow({ r }: { r: RivalryIndexRow }) {
  return (
    <li>
      <Link
        href={`/cfb/rivalries/${r.slug}`}
        className="flex items-baseline justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3 transition-colors hover:bg-white/[0.06]"
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{r.name}</span>
          <span className="block text-xs text-white/50">{r.matchup}</span>
          {/* Stadium and trophy where present; a missing trophy renders
              nothing (7 of 32 have none — never "no trophy", never inferred). */}
          {(r.venueName || r.trophy) && (
            <span className="block text-xs text-white/40">
              {[r.venueName, r.trophy].filter(Boolean).join(' · ')}
            </span>
          )}
        </span>
        <span className="shrink-0 text-sm text-white/45">{r.date ? monthDay(r.date) : 'Not in 2026'}</span>
      </Link>
    </li>
  );
}

export default async function Page() {
  const rows = await getMatchupIndexRows();
  // ONE source for every list and every count: the DOM lists, the ItemList
  // JSON-LD and the FAQ all derive from `rows`, so declared counts match
  // served counts by construction (aggregator plan §4).
  const ordered = orderedIndexRows(rows);
  const week = rivalryWeekRows(rows);
  const faqs = buildRivalryIndexFaqs(rows);
  const schemas = buildRivalryIndexJsonLd(ordered, faqs);

  return (
    <main className="min-h-screen text-white" style={{ background: '#08070d' }}>
      {/* One script per entity (house pattern). */}
      {schemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      <div className="mx-auto max-w-2xl px-4 pb-16 pt-4">
        <nav aria-label="Breadcrumb" className="text-[11px] uppercase tracking-wider text-white/45">
          <Link href="/cfb" className="hover:text-white">College Football</Link>
        </nav>
        <h1 className="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl">College Football Rivalries 2026</h1>
        <p className="mt-2 text-sm text-white/60">
          The date, the kickoff and the stadium for every rivalry we cover, in the order they are played.
        </p>

        {/* Seasonal section on a persistent page, not a date-scoped page: the
            window bounds are the definition, the games inside it are derived. */}
        {week.length > 0 && (
          <section className="mt-8">
            <h2 className="text-xl font-bold">Rivalry Week 2026</h2>
            <p className="mt-1 text-xs text-white/50">
              The last weekend of the regular season: {week.length} rivalries between November 21 and November 29.
            </p>
            <ul className="mt-4 space-y-2">
              {week.map((r) => (
                <RivalryRow key={r.slug} r={r} />
              ))}
            </ul>
          </section>
        )}

        <section className="mt-10">
          <h2 className="text-xl font-bold">All {ordered.length} rivalries, in date order</h2>
          <ul className="mt-4 space-y-2">
            {ordered.map((r) => (
              <RivalryRow key={r.slug} r={r} />
            ))}
          </ul>
        </section>

        {faqs.length > 0 && (
          <section className="mt-12">
            <h2 className="text-xl font-bold">Frequently asked questions</h2>
            <div className="mt-4 space-y-5">
              {faqs.map((f) => (
                <div key={f.question}>
                  <h3 className="text-sm font-semibold">{f.question}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-white/60">{f.answer}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
