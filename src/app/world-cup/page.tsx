import type { Metadata } from 'next';
import Link from 'next/link';
import { archivoHouse } from '@/components/redesign/fonts-house';
import { getWorldCupData } from '@/lib/world-cup-data';
import { WorldCupHostCard } from '@/components/world-cup/host-card';
import { AffiliateDisclosure } from '@/components/affiliates/AffiliateDisclosure';

const PAGE_URL = 'https://www.getpromonight.com/world-cup';

// 6h ISR, consistent with the rest of the site. Promo and schedule data flow in
// from Firestore at revalidate time so the host-city content stays current.
export const revalidate = 21600;

export const metadata: Metadata = {
  title: 'World Cup 2026 Host Cities: MLB Games to Catch Between Matches',
  description:
    'A fan guide to all 11 US World Cup 2026 host cities, June 11 to July 19. Find the local MLB ballpark in each city, the home games that line up with the World Cup, giveaway and theme nights, plus tickets, parking, and hotels.',
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: 'World Cup 2026 Host Cities: MLB Games to Catch Between Matches',
    description:
      'All 11 US World Cup host cities mapped to their local MLB ballparks and home games, June 11 to July 19, 2026.',
    url: PAGE_URL,
    siteName: 'PromoNight',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'PromoNight World Cup 2026 host-city fan guide',
      },
    ],
  },
};

const FAQS: { question: string; answer: string }[] = [
  {
    question: 'Which cities are hosting the 2026 World Cup in the United States?',
    answer:
      "Eleven US cities host 2026 World Cup matches: New York and New Jersey, Dallas, Atlanta, Miami, Los Angeles, Boston, Kansas City, Houston, Seattle, Philadelphia, and the San Francisco Bay Area. Together they stage 78 of the tournament's 104 matches, including both semi-finals, the third-place play-off, and the Final at MetLife Stadium on July 19, 2026.",
  },
  {
    question: 'Can I catch an MLB game while I am in town for the World Cup?',
    answer:
      'Yes. Every US host city has a Major League Baseball team near the stadium, several within walking distance, so you can pair a World Cup match with a ballgame. The best overlap is the group stage, June 11 to early July. The MLB All-Star break, around July 13 to 16, pauses all baseball during the semi-finals, then games resume on July 17, before the final.',
  },
  {
    question: 'When and where is the 2026 World Cup final?',
    answer:
      'The 2026 World Cup final is on Sunday, July 19, 2026 at MetLife Stadium in East Rutherford, New Jersey, just outside New York City. MetLife hosts eight matches in total. Yankee Stadium is about 12 miles away and Citi Field about 15, so a Yankees or Mets home game can bookend final weekend.',
  },
  {
    question: 'Why is there a World Cup match in Philadelphia on July 4?',
    answer:
      "Philadelphia hosts a World Cup Round of 16 at Lincoln Financial Field on July 4, 2026, Independence Day and America's 250th birthday, the first World Cup knockout match ever played on the Fourth. Ten days later the city hosts the MLB All-Star Game next door at Citizens Bank Park on July 14. One city, two majors, in one summer.",
  },
  {
    question: 'What is the best time to combine a World Cup trip with baseball?',
    answer:
      'The group stage, June 11 to early July, is the best window to pair the World Cup with a local MLB home game, because teams are playing a full schedule. From about July 13 to 16 the MLB All-Star break pauses every game, so mid-July host cities show no home dates during the semi-finals. Baseball resumes July 17, so a ballgame can still bookend the July 19 final.',
  },
];

export default async function WorldCupPage() {
  const data = await getWorldCupData();

  const updatedLong = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const updatedIso = new Date().toISOString();
  const cityCount = data.cities.length;

  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'World Cup 2026 Host Cities: MLB Games to Catch Between Matches',
    description:
      'All 11 US World Cup 2026 host cities mapped to their local MLB ballparks and home games, June 11 to July 19, 2026.',
    url: PAGE_URL,
    dateModified: updatedIso,
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
            FIFA World Cup 26 · Fan Guide
          </p>
          <h1 className="rd-display mt-1 text-4xl uppercase leading-[0.95] text-white md:text-6xl">
            World Cup Host Cities, Plus a Ballgame
          </h1>
          <p className="mt-4 font-rd text-[11px] uppercase tracking-[0.12em] text-white/55">
            June 11 to July 19 · 11 US Host Cities · Updated {updatedLong}
          </p>
          <p className="mt-4 max-w-3xl font-rd text-base leading-relaxed text-white/70 md:text-lg">
            The World Cup takes over 11 US cities this summer, and every one of them has a Major
            League Baseball team down the road. Here is how to catch a local ballgame, with its
            giveaways and theme nights, between matches.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-6 pb-20 pt-8">
        {/* Inverted-pyramid intro capsule */}
        <div className="rounded-2xl border border-rd-line bg-rd-card p-6 md:p-8">
          <p className="font-rd text-lg font-semibold leading-relaxed text-rd-ink md:text-xl">
            All 11 United States cities hosting the 2026 FIFA World Cup also have a Major League
            Baseball team within reach of the stadium, so you can catch a local MLB home game between
            World Cup matches on the same trip.
          </p>
          <p className="mt-4 font-rd text-[15px] leading-relaxed text-rd-ink-soft">
            The best window to pair the two is the group stage, June 11 to early July, when MLB teams
            are playing a full schedule. The MLB All-Star break, around July 13 to 16, pauses every
            baseball game during the World Cup semi-finals, so some mid-July host cities show no home
            games in that stretch. Baseball resumes July 17, in time to bookend the July 19 final.
            Each city card below maps the World Cup venue to its nearest ballpark,
            the home games that line up, and the giveaways on those dates.
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
              Philadelphia hosts a World Cup Round of 16 at Lincoln Financial Field on July 4, 2026,
              Independence Day and America&apos;s 250th birthday, the first World Cup knockout match
              ever played on the Fourth, in the city where the country was founded. Ten days later the MLB
              All-Star Game comes to Citizens Bank Park next door on July 14. Two majors, one South
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
            Ordered by the biggest match each city hosts, from the New York and New Jersey Final down
            to the group stage. Tickets route through Ticketmaster; parking and hotels route to the
            ballpark.
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
                Host-city teams running a soccer or World Cup themed jersey giveaway during the
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
              When a host-city team runs a soccer or World Cup themed jersey giveaway during the
              tournament, it shows up here. We are tracking every host-city calendar for one. In the
              meantime, browse jersey giveaways across the league.
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

        {/* Affiliate disclosure */}
        <section className="mt-12 border-t border-rd-line pt-6">
          <AffiliateDisclosure />
        </section>
      </div>
    </div>
  );
}
