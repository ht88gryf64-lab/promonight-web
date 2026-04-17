import type { FAQItem } from '@/lib/promo-helpers';

const HOMEPAGE_FAQS: FAQItem[] = [
  {
    question: 'What is PromoNight?',
    answer:
      'PromoNight is a free mobile app that tracks every promotional event at professional sports games across MLB, NBA, NFL, NHL, MLS, and WNBA. It shows giveaway nights, theme nights, food deals, and kids events for all 167 teams in one calendar view.',
  },
  {
    question: 'How many teams does PromoNight cover?',
    answer:
      'PromoNight tracks promotional schedules for 167 teams across six professional sports leagues: 30 MLB teams, 30 NBA teams, 32 NFL teams, 32 NHL teams, 29 MLS teams, and 13 WNBA teams (plus 1 expansion team).',
  },
  {
    question: 'Is PromoNight free?',
    answer:
      'Yes, PromoNight is free to download and use. The free version lets you track all teams and browse all promos. PromoNight Pro ($9.99/year or $5.99/season per sport) adds push notifications so you never miss a promo day.',
  },
  {
    question: 'What types of promotions does PromoNight track?',
    answer:
      'PromoNight tracks four categories of promotions: giveaways (bobbleheads, jerseys, collectibles), theme nights (Star Wars, pride, faith, heritage nights), food deals ($1 hot dogs, pregame happy hours), and kids/family events (kids run the bases, family Sundays).',
  },
  {
    question: 'How does PromoNight get its promo data?',
    answer:
      'PromoNight aggregates promotional schedules directly from official team sources, including team websites, ticketing platforms, and press releases. Data is updated regularly throughout each season to capture mid-season additions and changes.',
  },
];

export { HOMEPAGE_FAQS };

export function HomepageJsonLd() {
  const schemas = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'PromoNight',
      url: 'https://www.getpromonight.com',
      logo: 'https://www.getpromonight.com/logo.png',
      description:
        'PromoNight tracks every giveaway, theme night, food deal, and promotion across 167 professional sports teams in MLB, NBA, NFL, NHL, MLS, and WNBA.',
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
        'Track every giveaway, theme night, food deal, and promotion across 167 professional sports teams.',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'PromoNight',
      operatingSystem: 'iOS, Android',
      applicationCategory: 'SportsApplication',
      description:
        'Track every giveaway, theme night, food deal, and promotion across 167 teams in MLB, NBA, NFL, NHL, MLS, and WNBA.',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: HOMEPAGE_FAQS.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    },
  ];

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schemas) }}
    />
  );
}
