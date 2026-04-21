import Link from 'next/link';
import { getAllTeams, getHighlightedPromos, getPromoCount, getTeamPromos } from '@/lib/data';
import { HotPromosHero } from '@/components/hot-promos-hero';
import { AppDownloadButtons } from '@/components/app-download-buttons';
import { AppScreenshotStrip } from '@/components/app-screenshot-strip';
import { IndieDeveloperBlock } from '@/components/indie-developer-block';
import { TeamGrid } from '@/components/team-grid';
import { HomepageFAQ } from '@/components/homepage-faq';
import { HomepageJsonLd } from '@/components/homepage-json-ld';

export const revalidate = 3600;

export default async function HomePage() {
  const [promoCount, hotPromos, teams] = await Promise.all([
    getPromoCount(),
    getHighlightedPromos(8),
    getAllTeams(),
  ]);

  const popularTeams = teams.slice(0, 32);
  const promoCounts: Record<string, number> = {};
  await Promise.all(
    popularTeams.map(async (t) => {
      const promos = await getTeamPromos(t.id);
      promoCounts[t.id] = promos.length;
    })
  );

  return (
    <>
      <HomepageJsonLd />

      {/* Hero: Hot promo feed */}
      <section className="relative pt-28 pb-10 md:pb-14 px-6 overflow-hidden">
        <div
          className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[radial-gradient(circle,rgba(239,68,68,0.08)_0%,transparent_70%)] pointer-events-none"
          aria-hidden="true"
        />

        <div className="relative max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <span className="inline-flex items-center gap-2 bg-bg-card border border-accent-red-border rounded-full px-3 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-red animate-pulse-dot" />
              <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-accent-red">
                Live
              </span>
            </span>
            <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-text-muted">
              {promoCount.toLocaleString()} promos / 167 teams
            </span>
          </div>

          <h1 className="font-display text-[clamp(36px,6vw,64px)] leading-[0.95] tracking-[1px] mb-8 max-w-3xl">
            HOT TONIGHT{' '}
            <span className="text-text-secondary">&</span>{' '}
            <span className="bg-gradient-to-r from-accent-red to-promo-food bg-clip-text text-transparent">
              THIS WEEKEND
            </span>
          </h1>

          <HotPromosHero promos={hotPromos} />

          <div className="mt-12 text-center">
            <p className="text-text-secondary text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
              Every giveaway, theme night, and food deal at your team&apos;s games.
              {' '}
              <span className="text-white font-semibold">
                {promoCount.toLocaleString()} promos across 167 teams.
              </span>
            </p>
            <div className="mt-6">
              <AppDownloadButtons section="hero" page="home" />
            </div>
          </div>
        </div>
      </section>

      {/* App screenshots strip */}
      <AppScreenshotStrip />

      {/* How It Works */}
      <section className="py-20 px-6 border-t border-border-subtle">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">
              How it works
            </span>
            <h2 className="font-display text-4xl md:text-5xl tracking-[1px] mt-2">
              THREE SIMPLE STEPS
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: '01',
                icon: '🏟️',
                title: 'Pick Your Teams',
                desc: 'Follow your favorite teams across MLB, NBA, NFL, NHL, MLS, and WNBA. We track all 167.',
              },
              {
                step: '02',
                icon: '📅',
                title: 'Browse the Calendar',
                desc: 'See every upcoming giveaway, theme night, food deal, and kids event at a glance.',
              },
              {
                step: '03',
                icon: '🎟️',
                title: 'Get Tickets & Go',
                desc: 'Grab tickets to the games with the best promos. Never miss bobblehead night again.',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="bg-bg-card border border-border-subtle rounded-2xl p-8 text-center"
              >
                <div className="text-4xl mb-4">{item.icon}</div>
                <div className="font-mono text-[10px] tracking-[1.5px] text-accent-red mb-2">
                  STEP {item.step}
                </div>
                <h3 className="font-display text-2xl tracking-[0.5px] mb-3">{item.title}</h3>
                <p className="text-text-secondary text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Find Your Team */}
      <section className="py-20 px-6 border-t border-border-subtle">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-end justify-between mb-10">
            <div>
              <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">
                Find your team
              </span>
              <h2 className="font-display text-4xl md:text-5xl tracking-[1px] mt-2">
                167 TEAMS, 6 LEAGUES
              </h2>
            </div>
            <Link
              href="/teams"
              className="hidden md:inline-flex items-center gap-1 text-accent-red text-sm font-mono hover:underline"
            >
              View All
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
            </Link>
          </div>

          <TeamGrid teams={teams} promoCounts={promoCounts} limit={16} />

          <div className="mt-8 text-center md:hidden">
            <Link
              href="/teams"
              className="inline-flex items-center gap-1 text-accent-red text-sm font-mono hover:underline"
            >
              View All 167 Teams
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Indie developer narrative */}
      <IndieDeveloperBlock />

      {/* Final CTA */}
      <section className="py-24 px-6 border-t border-border-subtle text-center">
        <div className="max-w-2xl mx-auto">
          <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">
            Ready?
          </span>
          <h2 className="font-display text-4xl md:text-6xl tracking-[1px] mt-2 mb-6">
            STOP MISSING<br />THE GOOD GAMES
          </h2>
          <p className="text-text-secondary text-lg mb-10 max-w-md mx-auto">
            Download PromoNight and never miss another bobblehead, jersey giveaway, or dollar hot dog night.
          </p>
          <AppDownloadButtons section="footer_cta" page="home" />
        </div>
      </section>

      {/* FAQ */}
      <HomepageFAQ />
    </>
  );
}
