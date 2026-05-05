import type { Metadata } from 'next';
import Link from 'next/link';
import { AvatarMatt } from '@/components/avatar-matt';
import { AppDownloadButtons } from '@/components/app-download-buttons';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: { absolute: 'About PromoNight: The Indie App Behind the Promo Calendar' },
  description:
    'Independent app built by a Minnesota sports fan who kept missing the good games. Free, not affiliated with any league. A cleaner way to browse promos.',
  alternates: { canonical: 'https://www.getpromonight.com/about' },
};

const ABOUT_FAQS = [
  {
    question: 'Who runs PromoNight?',
    answer:
      "PromoNight is a solo project. It's built and maintained by Matt, a Minnesota-based developer and sports fan. No team, no league, and no ticketing company is involved.",
  },
  {
    question: 'Is PromoNight affiliated with MLB, the NBA, or any team?',
    answer:
      'No. PromoNight is independent. Promo data is pulled from publicly available team announcements and reviewed manually for accuracy.',
  },
  {
    question: 'How is PromoNight free?',
    answer:
      "The base app is free because gatekeeping promo information behind a paywall felt wrong. PromoNight Pro ($5.99 per season per sport or $9.99 per year for all sports) adds push notifications so you get a heads-up the morning of a promo day. That's the only paid feature.",
  },
  {
    question: 'Can I suggest a team or a feature?',
    answer:
      "Yes. Email hello@getpromonight.com. Every major league team in the US is already covered. If you're a fan of a minor league team or college team and you'd use this, let me know. That's a realistic next step.",
  },
];

export default async function AboutPage() {
  const schemas = [
    {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: 'Matt',
      jobTitle: 'Founder, PromoNight',
      worksFor: {
        '@type': 'Organization',
        name: 'PromoNight',
        url: 'https://www.getpromonight.com',
      },
      description:
        'Solo developer and Minnesota sports fan. Builder of PromoNight.',
      url: 'https://www.getpromonight.com/about',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: ABOUT_FAQS.map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemas) }}
      />

      <div className="pt-28 pb-20 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2 text-text-muted text-xs font-mono tracking-[0.5px] mb-6">
            <Link href="/" className="hover:text-white transition-colors">
              Home
            </Link>
            <span>/</span>
            <span className="text-text-secondary">About</span>
          </div>

          <div className="flex items-center gap-4 mb-8">
            <AvatarMatt size={64} />
            <div>
              <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">
                About
              </span>
              <h1 className="font-display text-4xl md:text-6xl tracking-[1px] mt-1">
                ABOUT PROMONIGHT
              </h1>
            </div>
          </div>

          <p className="text-text-secondary text-base leading-relaxed mb-12">
            PromoNight is a free iOS and Android app that tracks every promotional event at professional sports games across MLB, NBA, NHL, NFL, MLS, and WNBA. It covers giveaway nights, theme nights, food deals, and kids events across all 167 teams in one calendar view. It was built by a solo indie developer in Minneapolis who got tired of missing bobblehead night.
          </p>

          <section className="mb-12">
            <h2 className="font-display text-2xl md:text-3xl tracking-[1px] mb-4">
              Why I built this
            </h2>
            <div className="space-y-4 text-text-secondary text-[15px] leading-relaxed">
              <p>
                I&apos;m a Minnesota sports fan. Twins, Wild, Timberwolves, the whole stack. Last year I was trying to figure out which summer Twins game to bring my son to, and it turned out to be surprisingly hard work. Some games have bobbleheads. Some have fireworks. Some have kids running the bases after the final out, which is genuinely the best thing at a baseball game if you&apos;re eight years old. None of that information lives in one place.
              </p>
              <p>
                The Twins have a promo page. Ticketmaster has a different version. Local beat writers cover the promo calendar once in February and then never again. I ended up with a spreadsheet, which is a bad sign for a problem that millions of fans have.
              </p>
              <p>
                So I built the thing I wanted. A calendar. Tap a day, see what&apos;s happening. Push notification the morning of, so you actually remember. That&apos;s it. That&apos;s the whole app.
              </p>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="font-display text-2xl md:text-3xl tracking-[1px] mb-4">
              What PromoNight covers
            </h2>
            <p className="text-text-secondary text-[15px] leading-relaxed mb-4">
              PromoNight tracks four categories of promotions across 167 teams:
            </p>
            <ul className="space-y-3 text-text-secondary text-[15px] leading-relaxed list-disc pl-6">
              <li>
                <strong className="text-white">Giveaways</strong> - bobbleheads, jerseys, caps, replica trophies, collectibles. The stuff people plan their season around.
              </li>
              <li>
                <strong className="text-white">Theme nights</strong> - Star Wars, Harry Potter, heritage nights, pride celebrations, fireworks, concerts. The reason tonight&apos;s game is different from last Tuesday&apos;s.
              </li>
              <li>
                <strong className="text-white">Food deals</strong> - dollar dogs, two-dollar beer Fridays, kids eat free Sundays. The deals that make going to a game affordable when you&apos;re bringing the whole family.
              </li>
              <li>
                <strong className="text-white">Kids and family events</strong> - kids run the bases, face painting, family packs. The things that turn a baseball game into a day your kid remembers.
              </li>
            </ul>
            <p className="text-text-secondary text-[15px] leading-relaxed mt-5">
              The full season covers around 2,700 promotional events. I review and update the data regularly throughout the season because teams add promos mid-season and nobody else is watching.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="font-display text-2xl md:text-3xl tracking-[1px] mb-4">
              How PromoNight gets its data
            </h2>
            <div className="space-y-4 text-text-secondary text-[15px] leading-relaxed">
              <p>
                All promo data comes from official team sources. Team websites, ticketing platforms, and press releases. I wrote scrapers for the teams that publish in parseable formats and I review everything manually before it goes live. If a team announces a new promo halfway through the season, PromoNight picks it up within a few days.
              </p>
              <p>
                If you ever spot something that looks wrong, there&apos;s a &ldquo;report an issue&rdquo; button on every promo page in the app. Those reports come straight to me and I fix them fast. Data quality is the whole job.
              </p>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="font-display text-2xl md:text-3xl tracking-[1px] mb-4">
              Who PromoNight is for
            </h2>
            <div className="space-y-4 text-text-secondary text-[15px] leading-relaxed">
              <p>
                Regular-season attendees who go to a handful of games a year and want to make sure they&apos;re going on the right nights. Families choosing between Tuesday and Saturday. Collectors tracking bobbleheads. Out-of-town visitors catching a game in another city. Anyone who has ever shown up to a stadium, looked around, and realized they missed the giveaway.
              </p>
              <p>
                It&apos;s not for stat-heads, fantasy players, or betting. There are plenty of great apps for that. PromoNight does one thing.
              </p>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="font-display text-2xl md:text-3xl tracking-[1px] mb-4">
              Get in touch
            </h2>
            <div className="space-y-4 text-text-secondary text-[15px] leading-relaxed">
              <p>
                If you have feedback, a promo I missed, or a team you want covered better, email me at{' '}
                <a href="mailto:hello@getpromonight.com" className="text-accent-red hover:underline">
                  hello@getpromonight.com
                </a>
                . I read every message.
              </p>
              <p>
                If you want to follow along as PromoNight grows, the app has a Twitter account at{' '}
                <a
                  href="https://twitter.com/promo_night_app"
                  target="_blank"
                  rel="noopener"
                  className="text-accent-red hover:underline"
                >
                  @promo_night_app
                </a>{' '}
                that posts the day&apos;s best promos across the league.
              </p>
            </div>
          </section>

          <section className="mb-16">
            <h2 className="font-display text-2xl md:text-3xl tracking-[1px] mb-5">
              Frequently asked questions
            </h2>
            <div className="space-y-6">
              {ABOUT_FAQS.map((f, i) => (
                <div key={i}>
                  <h3 className="text-white font-semibold text-base mb-1.5">{f.question}</h3>
                  <p className="text-text-secondary text-[15px] leading-relaxed">{f.answer}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="mt-12 bg-bg-card border border-border-subtle rounded-2xl p-8 text-center">
            <h2 className="font-display text-2xl md:text-3xl tracking-[1px] mb-3">
              DOWNLOAD PROMONIGHT
            </h2>
            <p className="text-text-secondary text-sm mb-6">
              Free. 167 teams. 2,700+ promos.
            </p>
            <AppDownloadButtons section="about_cta" page="about" variant="compact" />
          </div>
        </div>
      </div>
    </>
  );
}
