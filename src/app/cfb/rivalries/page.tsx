import type { Metadata } from 'next';
import Link from 'next/link';
import { getMatchupIndexRows } from '@/lib/cfb/matchups';
import { buildCfbRivalryIndexMetadata } from '@/lib/cfb/metadata';
import {
  orderedIndexRows,
  rivalryWeekRows,
  rivalryWeekRange,
  rivalryWeekAnswer,
  rivalryWeekLong,
  rivalryIndexHeading,
  buildRivalryIndexFaqs,
  groupRivalryWeekByDay,
  groupIndexByMonth,
  type RivalryIndexRow,
  type RowGroup,
} from '@/lib/cfb/rivalry-index';
import { buildRivalryIndexJsonLd } from '@/lib/cfb/rivalry-jsonld';
import { barlowCondensed } from '@/components/cfb/rivalry/fonts';
import { Spine, RivalryWash, spineVars, CONDENSED, GOLD, RED } from '@/components/cfb/rivalry/spine';
import { cfbSeasonLabel } from '@/lib/cfb/season';
import { siteTodayYmd } from '@/lib/site-today';

export const revalidate = 21600; // ISR, same cadence as the CFB hub

// Hardcoded season year by house rule: never getFullYear() in SEO copy, bump
// deliberately when next-season content is ready. The title and description
// name the stored Rivalry Week game days (fix/gsc-cleanup-2026-11), so they
// read the same rows the page renders; getMatchupIndexRows is request-cached,
// so the metadata and the body share one read.
export async function generateMetadata(): Promise<Metadata> {
  return buildCfbRivalryIndexMetadata(await getMatchupIndexRows(), siteTodayYmd());
}

const PAGE_BG = '#08070d';

function monthDay(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function gamesLabel(n: number): string {
  return `${n} ${n === 1 ? 'game' : 'games'}`;
}

// Full-card row (the <Link> IS the card), shared by the Rivalry Week section
// and the full list so the two can never render a rivalry differently. Visual
// treatment from the approved mockup (docs/cfb-rivalries-mockup.html): split
// spine, condensed all-caps name, gold trophy; the 'week' variant is larger
// with the two-color corner wash. Href, text content and row count are
// unchanged — this pass must be invisible to the three-way count check.
function RivalryRow({ r, variant }: { r: RivalryIndexRow; variant: 'week' | 'list' }) {
  const week = variant === 'week';
  // matchup is built by joining exactly two school names with ' vs '
  // (matchups.ts), so this split only restyles; textContent is unchanged.
  const [schoolA, schoolB] = r.matchup.split(' vs ');
  return (
    <li>
      <Link
        href={`/cfb/rivalries/${r.slug}`}
        className={`relative block overflow-hidden rounded-[10px] border border-white/10 transition-[transform,border-color] duration-150 hover:-translate-y-px hover:border-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 ${week ? 'bg-white/[0.05]' : 'bg-white/[0.03]'}`}
        style={{ ...spineVars(r.colors), outlineColor: RED }}
      >
        <Spine colors={r.colors} />
        {week && <RivalryWash colors={r.colors} />}
        <span className={`relative block pl-[22px] pr-3.5 ${week ? 'py-[15px]' : 'py-[11px]'}`}>
          <span className="flex items-baseline justify-between gap-3">
            <span
              className={`min-w-0 font-bold uppercase leading-[1.1] tracking-[0.02em] ${week ? 'text-[23px]' : 'text-[18px]'}`}
              style={{ fontFamily: CONDENSED }}
            >
              {r.name}
            </span>
            <span className="shrink-0 text-[15px] font-semibold tracking-[0.06em] text-white/45" style={{ fontFamily: CONDENSED }}>
              {r.date ? monthDay(r.date) : `Not in ${cfbSeasonLabel()}`}
            </span>
          </span>
          <span className="mt-[3px] block text-[13.5px] text-white/50">
            <b className="font-semibold text-white">{schoolA}</b>
            <span className="text-white/35"> vs </span>
            <b className="font-semibold text-white">{schoolB}</b>
          </span>
          {/* Stadium and trophy where present; a missing trophy renders
              nothing (7 of 32 have none — never "no trophy", never inferred). */}
          {(r.venueName || r.trophy) && (
            <span className="mt-[7px] flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/40">
              {r.venueName && <span>{r.venueName}</span>}
              {/* Trophy glyph as a ::before pseudo-element, exactly like the
                  mockup: decorative, and never part of the row's textContent.
                  The pseudo becomes a flex item, so the gap spaces it. */}
              {r.trophy && (
                <span
                  className="inline-flex items-center gap-[5px] before:text-[11px] before:saturate-[0.7] before:content-['🏆']"
                  style={{ color: GOLD }}
                >
                  {r.trophy}
                </span>
              )}
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}

// Day rail inside Rivalry Week (mockup .day-label): gold, hairline, derived count.
function DayLabel({ g }: { g: RowGroup }) {
  return (
    <div
      className="mb-2.5 mt-[22px] flex items-center gap-2.5 text-[15px] font-bold uppercase tracking-[0.12em]"
      style={{ fontFamily: CONDENSED, color: GOLD }}
    >
      <span>
        {g.label}, {g.subLabel}
      </span>
      <span className="font-semibold tracking-[0.06em] text-white/35">{gamesLabel(g.rows.length)}</span>
      <span aria-hidden className="h-px flex-1 bg-white/10" />
    </div>
  );
}

// Sticky month header (mockup .month-label): red, page-bg fade so rows scroll
// under it, derived count. Pure CSS sticky — no client JS. top-14, not the
// mockup's top-0: the global BrandBar is itself sticky (top-0 h-14 z-40), so a
// top-0 label would stick hidden underneath it.
function MonthLabel({ g }: { g: RowGroup }) {
  return (
    <div
      className="sticky top-14 z-10 flex items-center gap-2.5 pb-2 pt-3.5 text-[17px] font-bold uppercase tracking-[0.14em]"
      style={{ fontFamily: CONDENSED, color: RED, background: `linear-gradient(${PAGE_BG} 82%, transparent)` }}
    >
      <span>{g.label}</span>
      <span className="text-[13px] font-semibold tracking-[0.06em] text-white/35">
        {g.key === 'unscheduled' ? `${g.rows.length} ${g.rows.length === 1 ? 'rivalry' : 'rivalries'}` : gamesLabel(g.rows.length)}
      </span>
      <span aria-hidden className="h-px flex-1 bg-white/10" />
    </div>
  );
}

export default async function Page() {
  const rows = await getMatchupIndexRows();
  // ONE source for every list and every count: the DOM lists, the ItemList
  // JSON-LD and the FAQ all derive from `rows`, so declared counts match
  // served counts by construction (aggregator plan §4). The day/month groups
  // are presentational partitions of these exact arrays.
  const ordered = orderedIndexRows(rows);
  const week = rivalryWeekRows(rows);
  const weekDays = groupRivalryWeekByDay(rows);
  const months = groupIndexByMonth(ordered);
  // The site's day (America/New_York): past RIVALRY_WEEK_END the answer
  // sentence, the description and the FAQ read in the past tense. ISR
  // (revalidate above) regenerates the page within its window of that day.
  const today = siteTodayYmd();
  const faqs = buildRivalryIndexFaqs(rows, today);
  // The stored game days inside the Rivalry Week window: the H1, the answer
  // sentence and the section line all print these, never the bounds.
  const range = rivalryWeekRange(rows);
  const heading = rivalryIndexHeading(rows);
  const schemas = buildRivalryIndexJsonLd(ordered, faqs, today);

  return (
    <div className={`min-h-screen text-white ${barlowCondensed.variable}`} style={{ background: PAGE_BG }} data-ad-region="content">
      {/* One script per entity (house pattern). */}
      {schemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      <div className="mx-auto max-w-2xl px-4 pb-20 pt-9">
        <nav aria-label="Breadcrumb">
          <Link
            href="/cfb"
            className="text-[13px] font-semibold uppercase tracking-[0.18em] text-white/45 transition-colors hover:text-white"
            style={{ fontFamily: CONDENSED }}
          >
            College Football
          </Link>
        </nav>
        {/* The H1 is the <title> (rivalryIndexTitle): "College Football Rivalry
            Week {season}: {first-last game day}". The spans are styling only,
            so the textContent is exactly headingText(heading). */}
        <h1
          className="mt-1.5 font-extrabold uppercase leading-[0.98] tracking-[0.01em]"
          style={{ fontFamily: CONDENSED, fontSize: 'clamp(38px, 9vw, 56px)' }}
        >
          {heading.lead} <span style={{ color: RED }}>{heading.season}</span>
          {heading.dates && <>: <span style={{ color: RED }}>{heading.dates}</span></>}
        </h1>
        <p className="mt-2.5 max-w-[46ch] text-sm text-white/60">
          {range && `${rivalryWeekAnswer(range, today)} `}
          The date, the kickoff and the stadium for every rivalry we cover, in the order they are played.
        </p>

        {/* Seasonal section on a persistent page, not a date-scoped page: the
            window bounds are the definition, the games inside it are derived. */}
        {week.length > 0 && (
          <section data-ad-item="rivalry-section" className="mt-9">
            <div
              className="flex items-baseline justify-between gap-3 border-b-2 pb-2.5"
              style={{ borderColor: 'rgba(224, 73, 46, 0.6)' }}
            >
              <h2 className="text-[30px] font-extrabold uppercase tracking-[0.02em]" style={{ fontFamily: CONDENSED }}>
                {`Rivalry Week ${cfbSeasonLabel()}`}
              </h2>
              <span
                className="shrink-0 text-sm font-semibold uppercase tracking-[0.08em] text-white/45"
                style={{ fontFamily: CONDENSED }}
              >
                {gamesLabel(week.length)}
              </span>
            </div>
            {range && (
              <p className="mt-1 text-[13px] text-white/40">
                {`${rivalryWeekLong(range)}.`}
              </p>
            )}
            {weekDays.map((g) => (
              <div key={g.key}>
                <DayLabel g={g} />
                <ul className="space-y-2.5">
                  {g.rows.map((r) => (
                    <RivalryRow key={r.slug} r={r} variant="week" />
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )}

        <section data-ad-item="rivalry-section" className="mt-12">
          <div className="border-b-2 border-white/10 pb-2.5">
            <h2 className="text-[26px] font-extrabold uppercase" style={{ fontFamily: CONDENSED }}>
              All {ordered.length} rivalries, in date order
            </h2>
          </div>
          {/* Month groups partition the SAME ordered array the ItemList reads:
              total row count, order, and the JSON-LD cannot change. */}
          {months.map((g) => (
            <div key={g.key}>
              <MonthLabel g={g} />
              <ul className="space-y-2">
                {g.rows.map((r) => (
                  <RivalryRow key={r.slug} r={r} variant="list" />
                ))}
              </ul>
            </div>
          ))}
        </section>

        {faqs.length > 0 && (
          <section data-ad-item="rivalry-section" className="mt-14">
            <h2 className="text-[26px] font-extrabold uppercase" style={{ fontFamily: CONDENSED }}>
              Frequently asked questions
            </h2>
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
    </div>
  );
}
