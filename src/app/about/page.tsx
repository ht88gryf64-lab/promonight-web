import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { pageOpenGraph } from '@/lib/og';
import Link from 'next/link';
import { AvatarMatt } from '@/components/avatar-matt';
import { AppDownloadButtons } from '@/components/app-download-buttons';
import { isRedesignEnabled } from '@/lib/redesign';
import { archivoHouse } from '@/components/redesign/fonts-house';
import { getAllTeams } from '@/lib/data';
import { getAllCfbSchoolIds } from '@/lib/cfb/data';
import { LEAGUE_ORDER, SCORED_LEAGUES } from '@/lib/types';
import {
  ABOUT_LAST_REVIEWED,
  ABOUT_LAST_REVIEWED_LABEL,
  aboutFaqs,
  aboutLede,
  aboutMetaDescription,
  aboutSections,
  type AboutCounts,
} from '@/lib/about-copy';

export const revalidate = 86400;

const CANONICAL = 'https://www.getpromonight.com/about';
const ORG_ID = 'https://www.getpromonight.com/#organization';
const PERSON_ID = `${CANONICAL}#matt`;
const PAGE_ID = `${CANONICAL}#webpage`;

function joinList(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

/** Coverage facts read from live data rather than typed into copy. The page
 *  previously hardcoded the team count in six places and a promo total that had
 *  gone stale, with nothing that would notice. */
async function getAboutCounts(): Promise<AboutCounts> {
  const [teams, cfbIds] = await Promise.all([getAllTeams(), getAllCfbSchoolIds()]);
  // Canonical order first, then anything the data carries that the constant
  // does not, so a new league appears in the counts without a code change.
  const leagues: string[] = LEAGUE_ORDER.filter((l) => teams.some((t) => t.league === l));
  for (const t of teams) if (!leagues.includes(t.league)) leagues.push(t.league);
  const scored = SCORED_LEAGUES as ReadonlySet<string>;
  const ranked = teams.filter((t) => scored.has(t.league));
  const rankedLeagues = leagues.filter((l) => scored.has(l));
  return {
    teamCount: teams.length,
    leagueCount: leagues.length,
    leagueList: joinList(leagues),
    cfbSchoolCount: cfbIds.length,
    rankedTeamCount: ranked.length,
    rankedLeagueList: joinList(rankedLeagues),
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const c = await getAboutCounts();
  return {
    title: { absolute: 'How PromoNight Tracks Sports Promotions' },
    description: aboutMetaDescription(c),
    alternates: { canonical: CANONICAL },
    openGraph: pageOpenGraph('/about'),
    // Overrides the root twitter block, which sets creator to @promo_night_app.
    // That is the product account, not a person, and this is the one page that
    // carries a personal byline. site keeps the publication; creator is dropped
    // rather than pointed at a personal handle that does not exist.
    twitter: {
      card: 'summary_large_image',
      site: '@promo_night_app',
      images: ['/og-image.png'],
    },
  };
}

/** Renders [label](/path) inline links from the copy module. Both gate variants
 *  use this, so the copy owns its links and the two branches cannot diverge. */
function Inline({ text, linkClass }: { text: string; linkClass: string }) {
  const parts: ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const [, label, href] = m;
    parts.push(
      href.startsWith('/') ? (
        <Link key={key++} href={href} className={linkClass}>
          {label}
        </Link>
      ) : (
        <a key={key++} href={href} className={linkClass}>
          {label}
        </a>
      ),
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

export default async function AboutPage() {
  const counts = await getAboutCounts();
  const lede = aboutLede(counts);
  const sections = aboutSections(counts);
  const faqs = aboutFaqs(counts);
  const light = isRedesignEnabled();

  // ONE SCRIPT TAG PER ENTITY (house pattern, src/components/homepage-json-ld.tsx:134).
  // The old page emitted a single 2-element array and connected nothing to
  // anything: a Person and a FAQPage as siblings, with no statement that the
  // person authored or was responsible for the page.
  //
  // AboutPage rather than ProfilePage. ProfilePage declares that the page IS a
  // profile of a person, which is the app-marketing reading this rewrite moves
  // away from. AboutPage says the page is about the publication, with the
  // Organization as mainEntity and the Person attached as author, which is the
  // stronger authorship signal anyway.
  //
  // Organization carries a stable @id, and the homepage Organization carries the
  // same one, so the two merge into a single company rather than reading as two
  // that happen to share a name. Verified against prod: one distinct @id across
  // both pages, zero dangling references.
  const schemas = [
    {
      '@context': 'https://schema.org',
      '@type': 'AboutPage',
      '@id': PAGE_ID,
      url: CANONICAL,
      name: 'How PromoNight Tracks Sports Promotions',
      description: aboutMetaDescription(counts),
      mainEntity: { '@id': ORG_ID },
      author: { '@id': PERSON_ID },
      // A real editorial date, bumped by hand when the copy changes and guarded
      // by src/lib/__tests__/about-freshness.test.ts. Not a render clock: see
      // the house ruling at src/components/json-ld.tsx:123.
      dateModified: ABOUT_LAST_REVIEWED,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Person',
      '@id': PERSON_ID,
      name: 'Matt Kovalik',
      jobTitle: 'Founder, PromoNight',
      image: 'https://www.getpromonight.com/matt-avatar.jpg',
      // @promo_night_app removed on purpose: sameAs on a Person asserts another
      // profile OF THAT PERSON, and the handle is the product account. It now
      // sits on the Organization, where the page's own prose already puts it.
      sameAs: ['https://www.linkedin.com/in/mattkovalik/'],
      worksFor: { '@id': ORG_ID },
      description: 'Solo developer and Minnesota sports fan. Builder of PromoNight.',
      url: CANONICAL,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': ORG_ID,
      name: 'PromoNight',
      legalName: 'Kovalik Digital LLC',
      url: 'https://www.getpromonight.com',
      logo: 'https://www.getpromonight.com/icon.png',
      email: 'hello@getpromonight.com',
      founder: { '@id': PERSON_ID },
      sameAs: ['https://x.com/promo_night_app', 'https://www.facebook.com/PromoNightApp'],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    },
  ];

  const jsonLd = (
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

  if (light) {
    const linkClass = 'text-rd-red hover:underline';
    return (
      <>
        {jsonLd}
        <div className={`${archivoHouse.variable} rd-root min-h-screen`}>
          <section className="relative overflow-hidden text-white" style={{ backgroundColor: '#1d1714' }}>
            <div
              aria-hidden
              className="absolute inset-0 z-0 opacity-60"
              style={{
                backgroundImage:
                  'radial-gradient(120% 80% at 100% 0%, rgba(218,45,32,0.16) 0%, transparent 60%)',
              }}
            />
            <div className="relative z-10 mx-auto flex max-w-3xl items-center gap-4 px-6 pb-12 pt-16 md:pb-14 md:pt-20">
              <AvatarMatt size={64} />
              <div>
                <span className="font-rd text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
                  About
                </span>
                <h1 className="rd-display mt-1 text-4xl uppercase leading-[0.95] text-white md:text-6xl">
                  How PromoNight Tracks Sports Promotions
                </h1>
                <p className="mt-2 font-rd text-[13px] text-white/60">
                  Matt Kovalik · Founder, PromoNight ·{' '}
                  <time dateTime={ABOUT_LAST_REVIEWED}>Last reviewed {ABOUT_LAST_REVIEWED_LABEL}</time>
                </p>
              </div>
            </div>
          </section>

          <div className="mx-auto max-w-3xl px-6 pb-20 pt-10 font-rd">
            <p className="text-rd-ink-soft text-base leading-relaxed mb-12">{lede}</p>

            {sections.map((section) => (
              <section key={section.id} id={section.id} className="mb-12">
                <h2 className="rd-display text-2xl md:text-3xl uppercase text-rd-ink mb-4">
                  {section.heading}
                </h2>
                <div className="space-y-4 text-rd-ink-soft text-[15px] leading-relaxed">
                  {section.blocks.map((block, i) =>
                    block.kind === 'p' ? (
                      <p key={i}>
                        <Inline text={block.text} linkClass={linkClass} />
                      </p>
                    ) : (
                      <ul key={i} className="space-y-3 list-disc pl-6">
                        {block.items.map((item, j) => (
                          <li key={j}>
                            <strong className="text-rd-ink">{item.lead}</strong>{' '}
                            <Inline text={item.text} linkClass={linkClass} />
                          </li>
                        ))}
                      </ul>
                    ),
                  )}
                </div>
                {section.id === 'app' && (
                  <div className="mt-6 flex">
                    <AppDownloadButtons section="about_cta" page="about" variant="compact" />
                  </div>
                )}
              </section>
            ))}

            <section className="mb-16">
              <h2 className="rd-display text-2xl md:text-3xl uppercase text-rd-ink mb-5">
                Frequently asked questions
              </h2>
              <div className="space-y-6">
                {faqs.map((f, i) => (
                  <div key={i}>
                    <h3 className="text-rd-ink font-semibold text-base mb-1.5">{f.question}</h3>
                    <p className="text-rd-ink-soft text-[15px] leading-relaxed">{f.answer}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </>
    );
  }

  const linkClass = 'text-accent-red hover:underline';
  return (
    <>
      {jsonLd}
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
              <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">About</span>
              <h1 className="font-display text-4xl md:text-6xl tracking-[1px] mt-1">
                How PromoNight Tracks Sports Promotions
              </h1>
              <p className="mt-2 font-mono text-[12px] text-text-secondary">
                Matt Kovalik · Founder, PromoNight ·{' '}
                <time dateTime={ABOUT_LAST_REVIEWED}>Last reviewed {ABOUT_LAST_REVIEWED_LABEL}</time>
              </p>
            </div>
          </div>

          <p className="text-text-secondary text-base leading-relaxed mb-12">{lede}</p>

          {sections.map((section) => (
            <section key={section.id} id={section.id} className="mb-12">
              <h2 className="font-display text-2xl md:text-3xl tracking-[1px] mb-4">{section.heading}</h2>
              <div className="space-y-4 text-text-secondary text-[15px] leading-relaxed">
                {section.blocks.map((block, i) =>
                  block.kind === 'p' ? (
                    <p key={i}>
                      <Inline text={block.text} linkClass={linkClass} />
                    </p>
                  ) : (
                    <ul key={i} className="space-y-3 list-disc pl-6">
                      {block.items.map((item, j) => (
                        <li key={j}>
                          <strong className="text-white">{item.lead}</strong>{' '}
                          <Inline text={item.text} linkClass={linkClass} />
                        </li>
                      ))}
                    </ul>
                  ),
                )}
              </div>
              {section.id === 'app' && (
                <div className="mt-6">
                  <AppDownloadButtons section="about_cta" page="about" variant="compact" />
                </div>
              )}
            </section>
          ))}

          <section className="mb-16">
            <h2 className="font-display text-2xl md:text-3xl tracking-[1px] mb-5">
              Frequently asked questions
            </h2>
            <div className="space-y-6">
              {faqs.map((f, i) => (
                <div key={i}>
                  <h3 className="text-white font-semibold text-base mb-1.5">{f.question}</h3>
                  <p className="text-text-secondary text-[15px] leading-relaxed">{f.answer}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
