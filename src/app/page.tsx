import Link from 'next/link';
import { getAllTeams, getHighlightedPromos, getPromoCount, getTeamPromos } from '@/lib/data';
import { TrendingPromos } from '@/components/trending-promos';
import { TeamGrid } from '@/components/team-grid';
import { TrackedAppLink } from '@/components/analytics-events';

export const revalidate = 3600;

export default async function HomePage() {
  const [promoCount, trendingPromos, teams] = await Promise.all([
    getPromoCount(),
    getHighlightedPromos(6),
    getAllTeams(),
  ]);

  // Get promo counts for popular teams (first 8 per league for display)
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
      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center text-center px-6 pt-20 pb-16 overflow-hidden">
        {/* Background effects */}
        <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[radial-gradient(circle,rgba(239,68,68,0.1)_0%,transparent_70%)] pointer-events-none" />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(rgba(26,27,34,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(26,27,34,0.06) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
            maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 0%, transparent 100%)',
          }}
        />

        <div className="relative z-10 max-w-3xl mx-auto">
          {/* Live badge */}
          <div className="animate-fade-up inline-flex items-center gap-2 bg-bg-card border border-accent-red-border rounded-full px-4 py-1.5 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-red animate-pulse-dot" />
            <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-accent-red">
              {promoCount.toLocaleString()} promos tracked across 167 teams
            </span>
          </div>

          {/* Headline */}
          <h1 className="animate-fade-up delay-1 font-display text-[clamp(48px,8vw,80px)] leading-[0.95] tracking-[1.5px] mb-6">
            NEVER MISS<br />
            <span className="bg-gradient-to-r from-accent-red to-promo-food bg-clip-text text-transparent">
              BOBBLEHEAD NIGHT
            </span>
            <br />AGAIN
          </h1>

          {/* Subtitle */}
          <p className="animate-fade-up delay-2 text-text-secondary text-lg leading-relaxed max-w-xl mx-auto mb-10">
            PromoNight tracks every giveaway, theme night, food deal, and promotion across MLB, NBA, NFL, NHL, MLS, and WNBA &mdash; so you always know when the good games are.
          </p>

          {/* CTA buttons */}
          <div className="animate-fade-up delay-3 flex items-center justify-center gap-4 flex-wrap mb-8">
            <TrackedAppLink
              href="/download"
              platform="ios"
              section="hero"
              page="home"
              className="inline-flex items-center gap-2 bg-accent-red text-white font-bold text-[15px] px-7 py-3.5 rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-[0_0_40px_rgba(239,68,68,0.3)]"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
              Download for iOS
            </TrackedAppLink>
            <Link
              href="/teams"
              className="inline-flex items-center gap-2 text-text-secondary font-mono text-sm px-6 py-3.5 rounded-xl border border-text-dim transition-all hover:border-text-secondary hover:text-white"
            >
              Browse Teams
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
            </Link>
          </div>

          {/* Trust signals */}
          <div className="animate-fade-up delay-4 flex items-center justify-center gap-6 text-text-muted text-sm">
            <span>Free to use</span>
            <span className="w-1 h-1 rounded-full bg-text-dim" />
            <span>167 teams</span>
            <span className="w-1 h-1 rounded-full bg-text-dim" />
            <span>6 leagues</span>
          </div>
        </div>
      </section>

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

      {/* Trending Promos */}
      <section className="border-t border-border-subtle">
        <TrendingPromos promos={trendingPromos} />
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
          <TrackedAppLink
            href="/download"
            platform="ios"
            section="footer_cta"
            page="home"
            className="inline-flex items-center gap-2 bg-accent-red text-white font-bold text-[15px] px-8 py-4 rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-[0_0_40px_rgba(239,68,68,0.3)]"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
            Download for iOS
          </TrackedAppLink>
        </div>
      </section>
    </>
  );
}
