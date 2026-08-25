import type { FAQItem } from '@/lib/promo-helpers';
import { leagueSplit, numberWord, type CoverageCounts } from '@/lib/coverage-counts';

/** Coverage facts the homepage states in prose and in schema. One derivation
 *  for the whole site (src/lib/coverage-counts.ts), never written by hand: the
 *  literals these replaced had gone stale before and there is no alarm that
 *  would catch it. The name survives for the homepage's callers. */
export type HomepageCounts = CoverageCounts;

export function buildHomepageFaqs(c: HomepageCounts): FAQItem[] {
  return [
  {
    question: 'What is PromoNight?',
    answer:
      `PromoNight is a free mobile app that tracks every promotional event at professional sports games across ${c.leagueList}. It shows giveaway nights, theme nights, food deals, and kids events for all ${c.teamCount} teams in one calendar view.`,
  },
  {
    question: 'How many teams does PromoNight cover?',
    answer:
      `PromoNight tracks promotional schedules for ${c.teamCount} teams across ${numberWord(c.leagueCount)} professional sports leagues: ${leagueSplit(c.leagueBreakdown)}.`,
  },
  {
    question: 'Is PromoNight free?',
    answer:
      'Yes, PromoNight is free to download and use. The free version lets you track all teams and browse all promos. PromoNight Pro ($9.99/year or $5.99/season per sport) adds a reminder that the app schedules on your device for the morning of each promo day.',
  },
  {
    question: 'What types of promotions does PromoNight track?',
    answer:
      'PromoNight tracks four categories of promotions: giveaways (bobbleheads, jerseys, collectibles), theme nights (Star Wars, pride, faith, heritage nights), food deals ($1 hot dogs, pregame happy hours), and kids/family events (kids run the bases, family Sundays).',
  },
  {
    question: 'How does PromoNight get its promo data?',
    answer:
      'PromoNight aggregates promotional schedules directly from official team sources, including team websites, ticketing platforms, and press releases. MLB, WNBA, and MLS schedules are rechecked weekly in season, and other leagues are updated as new announcements are confirmed.',
  },
  ];
}

export function HomepageJsonLd({ counts }: { counts: HomepageCounts }) {
  const faqs = buildHomepageFaqs(counts);
  const schemas = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      // Stable @id so this node and the Organization on /about are read as ONE
      // company rather than two. /about carries founder, legalName and the
      // AboutPage that names it as mainEntity; without a shared identifier a
      // consumer sees two unrelated organizations with the same name.
      '@id': 'https://www.getpromonight.com/#organization',
      name: 'PromoNight',
      url: 'https://www.getpromonight.com',
      // /logo.png has never existed in public/ and returns 404 in production.
      // /icon.png is the Next app icon (src/app/icon.png), 192x192, served 200,
      // and is the actual brand mark. A purpose-made wordmark is separate
      // design work; this is the property Google reads for publisher identity
      // and it should point at a file that resolves.
      logo: 'https://www.getpromonight.com/icon.png',
      description:
        `PromoNight tracks every giveaway, theme night, food deal, and promotion across ${counts.teamCount} professional sports teams in ${counts.leagueList}.`,
      email: 'hello@getpromonight.com',
      sameAs: [
        'https://x.com/promo_night_app',
        'https://www.facebook.com/PromoNightApp',
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'PromoNight',
      url: 'https://www.getpromonight.com',
      description:
        `Track every giveaway, theme night, food deal, and promotion across ${counts.teamCount} professional sports teams.`,
    },
    // SoftwareApplication intentionally omitted: Google's Software App rich
    // result requires aggregateRating (or review) alongside offers, and we have
    // no legitimate rating data to publish. Emitting it caused the homepage
    // rich-results validation error. Re-add with real ratings if/when we have
    // them.
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    },
  ];

  // One script tag per entity (house pattern), rather than a single array.
  return (
    <>
      {schemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  );
}
