import type { Metadata } from 'next';
import Link from 'next/link';
import { archivoHouse } from '@/components/redesign/fonts-house';
import { getWorldCupData } from '@/lib/world-cup-data';
import { WorldCupHostCard } from '@/components/world-cup/host-card';
import { isWorldCupActive } from '@/lib/world-cup-active';

const PAGE_URL = 'https://www.getpromonight.com/world-cup';

// 6h ISR, consistent with the rest of the site. Promo and schedule data flow in
// from Firestore at revalidate time so the host-city content stays current.
export const revalidate = 21600;

// THE PAGE READS THE CLOCK NOW. isWorldCupActive() shipped on 2026-06-xx with
// exactly one call site, src/app/layout.tsx:115, gating the announcement strip
// and the nav link. Its own comment said "The /world-cup hub page itself stays
// live regardless", and that decision is what went stale: the tournament ended
// 2026-07-19 and the page kept selling tickets to it in the future tense for six
// weeks. The gate now reaches the behaviour that depends on tournament state.
//
// WHY THE PROSE IS NOT ALSO BRANCHED. The copy below is written in the past
// tense with absolute dates ("ran June 11 to July 19, 2026"), not gated behind
// this flag. Time-relative copy is what went stale; time-absolute copy cannot.
// Shipping a second full set of strings for a branch that can never be true
// again (WORLD_CUP_END is a fixed 2026 date) would be two copies to drift
// instead of one. The live-tense original is in git at db28365 if a future
// edition needs it.

// A dated retrospective, and the title says so. The old title and description
// promised a forward-looking fan guide with "tickets, parking, and hotels",
// none of which this page offers any more.
export function generateMetadata(): Metadata {
  const title = isWorldCupActive()
    ? 'World Cup 2026: 11 US Host Cities & MLB Ballparks'
    : 'World Cup 2026: How the 11 US Host Cities Played Out';
  const description = isWorldCupActive()
    ? 'A fan guide to all 11 US World Cup 2026 host cities, June 11 to July 19. Find the local MLB ballpark in each city, the home games that line up with the World Cup, giveaway and theme nights.'
    : 'A record of the 2026 World Cup in the United States, June 11 to July 19, 2026: all 11 host cities, the local MLB ballpark in each, the home games that fell inside the tournament window, and the giveaways on those dates.';
  return {
    title,
    description,
    alternates: { canonical: PAGE_URL },
    openGraph: {
      title,
      description,
      url: PAGE_URL,
      siteName: 'PromoNight',
      type: 'website',
      images: [
        {
          url: '/og-image.png',
          width: 1200,
          height: 630,
          alt: 'PromoNight World Cup 2026 host-city guide',
        },
      ],
    },
  };
}

const FAQS: { question: string; answer: string }[] = [
  {
    question: 'Which cities hosted the 2026 World Cup in the United States?',
    answer:
      "Eleven US cities hosted 2026 World Cup matches: New York and New Jersey, Dallas, Atlanta, Miami, Los Angeles, Boston, Kansas City, Houston, Seattle, Philadelphia, and the San Francisco Bay Area. Between them they staged 78 of the tournament's 104 matches, including both semi-finals, the third-place play-off, and the Final at MetLife Stadium on July 19, 2026.",
  },
  {
    question: 'Could you catch an MLB game while you were in town for the World Cup?',
    answer:
      'Yes. Every US host city has a Major League Baseball team near the stadium, several within walking distance, so a World Cup match and a ballgame could share a trip. The best overlap was the group stage, June 11 to early July 2026. The MLB All-Star break, July 13 to 16, paused all baseball during the semi-finals; games resumed on July 17, before the final.',
  },
  {
    question: 'When and where was the 2026 World Cup final?',
    answer:
      'The 2026 World Cup final was played on Sunday, July 19, 2026 at MetLife Stadium in East Rutherford, New Jersey, just outside New York City. MetLife hosted eight matches in total. Yankee Stadium is about 12 miles away and Citi Field about 15, so a Yankees or Mets home game could bookend final weekend.',
  },
  {
    question: 'Why was there a World Cup match in Philadelphia on July 4?',
    answer:
      "Philadelphia hosted a World Cup Round of 16 at Lincoln Financial Field on July 4, 2026, Independence Day and America's 250th birthday, the first World Cup knockout match ever played on the Fourth. Ten days later the city hosted the MLB All-Star Game next door at Citizens Bank Park on July 14. One city, two majors, in one summer.",
  },
  {
    question: 'When was the best time to combine a World Cup trip with baseball?',
    answer:
      'The group stage, June 11 to early July 2026, was the best window to pair the World Cup with a local MLB home game, because teams were playing a full schedule. From July 13 to 16 the MLB All-Star break paused every game, so mid-July host cities showed no home dates during the semi-finals. Baseball resumed July 17, so a ballgame could still bookend the July 19 final.',
  },
];

export default async function WorldCupPage() {
  const data = await getWorldCupData();

  const active = isWorldCupActive();
  const cityCount = data.cities.length;

  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: active
      ? 'World Cup 2026: 11 US Host Cities & MLB Ballparks'
      : 'World Cup 2026: How the 11 US Host Cities Played Out',
    description:
      'All 11 US World Cup 2026 host cities mapped to their local MLB ballparks and the home games that fell inside the June 11 to July 19, 2026 tournament window.',
    url: PAGE_URL,
    isPartOf: {
      '@type': 'WebSite',
      name: 'PromoNight',
      url: 'https://www.getpromonight.com',
    },
    about: data.cities.map((c) => ({
      '@type': 'Place',
      name: `${c.city.wcVenue}, ${c.city.city}`,
    })),
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };

  // SocialEvent JSON-LD for fan festivals with a concrete single venue and date
  // window: the single-venue cities, both NY/NJ fan zones, and the LA Coliseum
  // opening week. Distributed programs (SF Bay Area, Seattle) and the vague
  // citywide LA phase carry no startDate, so they are skipped.
  //
  // GATED ON THE TOURNAMENT CLOCK. These ten objects carried
  // eventStatus EventScheduled over startDates in June and July 2026, which
  // asserted to every consumer that a finished festival was still upcoming.
  // schema.org has no "this happened" status that fits (EventMovedOnline,
  // EventPostponed and EventCancelled are all false here), so the retrospective
  // emits nothing rather than a status that is wrong. CollectionPage and
  // FAQPage still ship; only the forward-looking claim is dropped.
  const fanFestEvents = active ? data.cities.flatMap((c) => {
    const f = c.city.fanFestival;
    const cityName = c.city.city.split(' / ')[0];
    return (f.venues ?? [])
      .filter((v) => v.startDate)
      .map((v) => ({
        '@context': 'https://schema.org',
        '@type': 'SocialEvent',
        name: `${v.name} — FIFA World Cup 2026 Fan Festival`,
        description: `Official FIFA World Cup 2026 Fan Festival in ${cityName}. ${f.admission}.`,
        startDate: v.startDate,
        ...(v.endDate ? { endDate: v.endDate } : {}),
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        eventStatus: 'https://schema.org/EventScheduled',
        isAccessibleForFree: true,
        location: {
          '@type': 'Place',
          name: v.name,
          address: cityName,
        },
        organizer: { '@type': 'Organization', name: 'FIFA', url: 'https://www.fifa.com' },
        url: f.officialUrl,
      }));
  }) : [];

  const jersey = data.soccerJerseyEntries;

  return (
    <div className={`${archivoHouse.variable} rd-root min-h-screen`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      {fanFestEvents.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(fanFestEvents) }}
        />
      )}

      {/* Charcoal hero */}
      <section className="relative overflow-hidden text-white" style={{ backgroundColor: '#1d1714' }}>
        <div
          aria-hidden
          className="absolute inset-0 z-0 opacity-70"
          style={{
            backgroundImage:
              'radial-gradient(120% 80% at 100% 0%, rgba(211,17,69,0.22) 0%, transparent 60%)',
          }}
        />
        <div className="relative z-10 mx-auto max-w-5xl px-6 pb-12 pt-16 md:pb-14 md:pt-20">
          <p className="font-rd text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: '#ff5a78' }}>
            FIFA World Cup 26 · Retrospective
          </p>
          <h1 className="rd-display mt-1 text-4xl uppercase leading-[0.95] text-white md:text-6xl">
            World Cup Host Cities, Plus a Ballgame
          </h1>
          <p className="mt-4 font-rd text-[11px] uppercase tracking-[0.12em] text-white/55">
            June 11 to July 19, 2026 · 11 US Host Cities · Tournament complete
          </p>
          <p className="mt-4 max-w-3xl font-rd text-base leading-relaxed text-white/70 md:text-lg">
            The 2026 World Cup ran across 11 US cities from June 11 to July 19, and every one of
            them has a Major League Baseball team down the road. This is the record of which
            ballgames fell inside that window, and the giveaways and theme nights that landed on
            those dates.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-6 pb-20 pt-8">
        {/* Inverted-pyramid intro capsule */}
        <div className="rounded-2xl border border-rd-line bg-rd-card p-6 md:p-8">
          <p className="font-rd text-lg font-semibold leading-relaxed text-rd-ink md:text-xl">
            All 11 United States cities that hosted the 2026 FIFA World Cup also have a Major
            League Baseball team within reach of the stadium, so a local MLB home game and a World
            Cup match could share a trip.
          </p>
          <p className="mt-4 font-rd text-[15px] leading-relaxed text-rd-ink-soft">
            The best window to pair the two was the group stage, June 11 to early July 2026, when
            MLB teams were playing a full schedule. The MLB All-Star break, July 13 to 16, paused
            every baseball game during the World Cup semi-finals, so some mid-July host cities had
            no home dates in that stretch. Baseball resumed July 17, in time to bookend the July 19
            final. Each city card below maps the World Cup venue to its nearest ballpark, the home
            games that fell inside the window, and the giveaways on those dates.
          </p>
        </div>

        {/* Philadelphia: a summer of two majors */}
        <section className="relative mt-8 overflow-hidden rounded-2xl text-white" style={{ backgroundColor: '#1d1714' }}>
          <div
            aria-hidden
            className="absolute inset-0 z-0 opacity-70"
            style={{
              backgroundImage:
                'radial-gradient(120% 90% at 0% 0%, rgba(211,17,69,0.22) 0%, transparent 60%)',
            }}
          />
          <div className="relative z-10 p-6 md:p-8">
            <span className="inline-flex items-center rounded-full bg-rd-red px-2.5 py-1 font-rd text-[10px] font-semibold uppercase tracking-[0.1em] text-white">
              Philadelphia · July 4 and July 14
            </span>
            <h2 className="rd-display mt-3 text-2xl uppercase text-white md:text-3xl">
              A summer of two majors
            </h2>
            <p className="mt-3 max-w-3xl font-rd text-[15px] leading-relaxed text-white/75 md:text-base">
              Philadelphia hosted a World Cup Round of 16 at Lincoln Financial Field on July 4, 2026,
              Independence Day and America&apos;s 250th birthday, the first World Cup knockout match
              ever played on the Fourth, in the city where the country was founded. Ten days later the
              MLB All-Star Game came to Citizens Bank Park next door on July 14. Two majors, one South
              Philadelphia complex, ten days apart.
            </p>
            <Link
              href="#philadelphia"
              className="mt-4 inline-block font-rd text-[12px] font-semibold uppercase tracking-[0.08em]"
              style={{ color: '#ff5a78' }}
            >
              Jump to Philadelphia →
            </Link>
          </div>
        </section>

        {/* Host cities */}
        <section className="mt-12">
          <span className="font-rd text-[11px] font-semibold uppercase tracking-[0.14em] text-rd-ink-faint">
            {cityCount} US host cities
          </span>
          <h2 className="rd-display mt-1 text-3xl uppercase text-rd-ink md:text-4xl">Host Cities</h2>
          <p className="mt-2 max-w-3xl font-rd text-sm leading-relaxed text-rd-ink-soft md:text-base">
            Ordered by the biggest match each city hosted, from the New York and New Jersey Final
            down to the group stage.
          </p>
          <div className="mt-6 space-y-6">
            {data.cities.map((c) => (
              <WorldCupHostCard key={c.city.slug} data={c} />
            ))}
          </div>
        </section>

        {/* Soccer jersey nights teaser */}
        <section className="mt-12 rounded-2xl border border-rd-line bg-rd-card p-6 md:p-8">
          <span className="font-rd text-[11px] font-semibold uppercase tracking-[0.14em] text-rd-ink-faint">
            Soccer jersey nights
          </span>
          <h2 className="rd-display mt-1 text-2xl uppercase text-rd-ink md:text-3xl">
            World Cup jerseys at the ballpark
          </h2>
          {jersey.length > 0 ? (
            <>
              <p className="mt-2 font-rd text-[15px] leading-relaxed text-rd-ink-soft">
                Host-city teams that ran a soccer or World Cup themed jersey giveaway during the
                tournament:
              </p>
              <ul className="mt-3 space-y-1.5">
                {jersey.map((e, i) => (
                  <li key={i} className="font-rd text-sm text-rd-ink">
                    <Link href={`/mlb/${e.teamSlug}`} className="font-semibold hover:text-rd-red">
                      {e.teamDisplay}
                    </Link>
                    <span className="text-rd-ink-soft">
                      {' '}
                      · {e.promo.title}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-2 font-rd text-[15px] leading-relaxed text-rd-ink-soft">
              No host-city team ran a soccer or World Cup themed jersey giveaway inside the
              tournament window. Jersey giveaways across the league are still tracked.
            </p>
          )}
          <Link
            href="/promos/soccer-jersey-nights"
            className="mt-4 inline-block rounded-xl border border-rd-line-strong px-4 py-2.5 font-rd text-[12px] font-semibold uppercase tracking-[0.08em] text-rd-ink-soft transition-colors hover:border-rd-ink hover:text-rd-ink"
          >
            All soccer jersey nights →
          </Link>
        </section>

        {/* FAQ */}
        <section className="mt-16 border-t border-rd-line pt-10">
          <h2 className="rd-display text-3xl uppercase text-rd-ink md:text-4xl">
            Frequently Asked Questions
          </h2>
          <div className="mt-8 max-w-3xl space-y-6">
            {FAQS.map((f, i) => (
              <div key={i}>
                <h3 className="font-rd text-base font-semibold text-rd-ink">{f.question}</h3>
                <p className="mt-1.5 font-rd text-sm leading-relaxed text-rd-ink-soft">{f.answer}</p>
              </div>
            ))}
          </div>
        </section>

        {/* No affiliate disclosure, because there is nothing left to disclose.
            The 55 partner links and the per-row ticket, parking and hotel CTAs
            are gone with the retrospective, and a page that keeps claiming "we
            may earn a commission on links on this page" over zero such links is
            making a false statement in the other direction. The build guard in
            scripts/verify-affiliate-tracking.ts agrees: /world-cup no longer
            reaches an affiliate emitter, so it no longer requires a disclosure,
            and the emitting-route count drops from 15 to 14. */}
      </div>
    </div>
  );
}
