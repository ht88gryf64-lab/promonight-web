import type { FAQItem } from '@/lib/promo-helpers';
import type { Team } from '@/lib/types';
import { LEAGUE_ORDER } from '@/lib/types';

/** Coverage facts the homepage states in prose and in schema. Derived from the
 *  teams collection the homepage already fetches, never written by hand: the
 *  literals these replaced had gone stale before and there is no alarm that
 *  would catch it. */
export interface HomepageCounts {
  teamCount: number;
  leagueCount: number;
  /** [league, teams] in canonical presentation order. */
  leagueBreakdown: Array<[string, number]>;
}

export function homepageCountsFromTeams(teams: Team[]): HomepageCounts {
  const per = new Map<string, number>();
  for (const t of teams) per.set(t.league, (per.get(t.league) ?? 0) + 1);
  // Canonical order rather than a derived one on purpose. This string is
  // published as FAQPage answer text on both homepage gate variants, and the
  // standing constraint is that the gate-off page stays byte-identical. The
  // COUNTS are what go stale and are derived; the presentation order is not a
  // fact about the data.
  const leagueBreakdown = LEAGUE_ORDER.filter((l) => per.has(l)).map(
    (l) => [l, per.get(l) as number] as [string, number],
  );
  for (const [league, n] of per) {
    if (!leagueBreakdown.some(([l]) => l === league)) leagueBreakdown.push([league, n]);
  }
  return { teamCount: teams.length, leagueCount: per.size, leagueBreakdown };
}

// Spelled-out small numbers, so deriving a count does not silently rewrite
// "six professional sports leagues" as "6 professional sports leagues".
const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
function numberWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

function leagueList(breakdown: Array<[string, number]>): string {
  const names = breakdown.map(([l]) => l);
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

function leagueSplit(breakdown: Array<[string, number]>): string {
  const parts = breakdown.map(([l, n]) => `${n} ${l} teams`);
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

export function buildHomepageFaqs(c: HomepageCounts): FAQItem[] {
  return [
  {
    question: 'What is PromoNight?',
    answer:
      `PromoNight is a free mobile app that tracks every promotional event at professional sports games across ${leagueList(c.leagueBreakdown)}. It shows giveaway nights, theme nights, food deals, and kids events for all ${c.teamCount} teams in one calendar view.`,
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
      name: 'PromoNight',
      url: 'https://www.getpromonight.com',
      logo: 'https://www.getpromonight.com/logo.png',
      description:
        `PromoNight tracks every giveaway, theme night, food deal, and promotion across ${counts.teamCount} professional sports teams in ${leagueList(counts.leagueBreakdown)}.`,
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
