import type { Metadata } from 'next';
import { getCfbHubData } from '@/lib/cfb/hub-data';
import { instrumentSerif } from '@/components/cfb/fonts';
import { NationalBlock, WeekCard, ThemeCard } from '@/components/cfb/hub/blocks';
import { CfbHubBrowse } from '@/components/cfb/hub/CfbHubBrowse';
import { CfbHubSearch } from '@/components/cfb/hub/CfbHubSearch';

// ISR — same 21600s window the homepage/playoffs use for date-rollover safety;
// the §14a Monday-AM weekly-rail cutover lands overnight within this window.
export const revalidate = 21600;

const GOLD = '#FFB71E';
const RED = '#e0492e';
const SERIF = 'var(--font-cfb-serif), Georgia, serif';
const MONO = 'var(--font-mono), ui-monospace, monospace';
const SANS = 'var(--font-outfit), system-ui, sans-serif';

export const metadata: Metadata = {
  // Rivalry-first per §13 (schedule head terms are unwinnable; rivalry/theme are the wedge).
  title: 'College Football 2026: Rivalries, Road Trips & Gameday',
  description:
    'Every 2026 college football rivalry game with trophies, theme nights, and gameday plans for 86 teams — The Game, Iron Bowl, Red River, and every Saturday that matters.',
  alternates: { canonical: '/cfb' },
};

function SectionLabel({ children, sub, right }: { children: React.ReactNode; sub?: string; right?: string }) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-[12px] tracking-[0.16em]" style={{ fontFamily: MONO, color: GOLD }}>{children}</div>
        {right && <div className="shrink-0 text-[10px] text-white/35" style={{ fontFamily: MONO }}>{right}</div>}
      </div>
      {sub && <div className="mt-1.5 text-[14px] text-white/55" style={{ fontFamily: SANS }}>{sub}</div>}
    </>
  );
}

export default async function CfbHub() {
  const data = await getCfbHubData();
  const allTeams = data.browse.flatMap((b) => b.teams.map((t) => ({ id: t.id, name: t.name })));
  const weeklyLabel = data.weekly.label === 'this-week' ? 'THIS WEEK · RIVALRY GAMES' : 'NEXT UP · RIVALRY GAMES';
  const weeklyRight = data.weekly.label === 'this-week' && data.weekly.week
    ? `UPDATES MONDAY AM · WEEK ${data.weekly.week}`
    : 'UPDATES MONDAY AM';

  return (
    <main className={`min-h-screen text-white ${instrumentSerif.variable}`} style={{ background: '#08070d', fontFamily: SANS }}>
      {/* ── HERO — rivalry/road-trip framing, league-neutral gold/red wash. Text is
          FULL-opacity white + shadow over the wash (the washout lesson — no
          reduced-opacity white over the gradient). ── */}
      <header className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[360px]" style={{ background: `radial-gradient(ellipse 80% 70% at 25% -20%, ${GOLD}22 0%, transparent 60%)` }} />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[360px]" style={{ background: `radial-gradient(ellipse 60% 60% at 90% 0%, ${RED}18 0%, transparent 55%)` }} />
        <div className="relative mx-auto max-w-6xl px-5 pb-8 pt-12 sm:px-10 sm:pt-14">
          <div className="mb-5 flex items-center gap-2.5 text-[12px] tracking-[0.2em]" style={{ fontFamily: MONO, color: GOLD }}>
            <span className="inline-block h-px w-7" style={{ background: GOLD }} /> COLLEGE FOOTBALL · 2026
          </div>
          <h1 className="max-w-3xl italic text-white" style={{ fontFamily: SERIF, fontSize: 'clamp(2.6rem, 6.5vw, 4.4rem)', lineHeight: 0.98, letterSpacing: '-0.02em', textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}>
            The rivalries, the road trips,<br className="hidden sm:block" /> and every Saturday that matters.
          </h1>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-white/70" style={{ fontFamily: SANS, textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
            Trophy games, theme nights, and gameday plans for {data.totalTeams} teams. Built for fans who actually go.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <CfbHubSearch teams={allTeams} />
            <a href="#browse" className="rounded-lg px-5 py-3 text-[13px] font-bold" style={{ fontFamily: SANS, background: GOLD, color: '#08070d' }}>Browse all {data.totalTeams} →</a>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 pb-24 sm:px-10">

        {/* ── THIS WEEK · RIVALRY GAMES rail (§14a — rolls Monday AM) ── */}
        {data.weekly.games.length > 0 && (
          <section className="mt-4">
            <SectionLabel right={weeklyRight}>{weeklyLabel}</SectionLabel>
            <div className="mt-4 flex gap-3 overflow-x-auto pb-3">
              {data.weekly.games.map((g) => <WeekCard key={g.id} game={g} />)}
            </div>
          </section>
        )}

        {/* ── NATIONAL rivalries (§9 curated layer; §14b diagonal blocks) ── */}
        <section className="mt-14">
          <SectionLabel sub="The games people plan their whole fall around.">THE RIVALRIES THAT DEFINE THE SEASON</SectionLabel>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {data.national.map((b) => <NationalBlock key={b.key} block={b} />)}
          </div>
        </section>

        {/* ── THEME GAMES (curated identities; single-color cards, NOT diagonal) ── */}
        {data.theme.length > 0 && (
          <section className="mt-14">
            <SectionLabel sub="When the whole stadium picks a color.">THEME GAMES ACROSS THE COUNTRY</SectionLabel>
            <div className="mt-5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
              {data.theme.map((t) => <ThemeCard key={t.school.id} theme={t} />)}
            </div>
          </section>
        )}

        {/* ── BROWSE all 86 (§14 crawlability — all links in DOM, CSS filter only) ── */}
        <section id="browse" className="mt-14 scroll-mt-6">
          <SectionLabel sub="Pick your team for its full schedule, rivalries, and gameday plan.">BROWSE ALL {data.totalTeams} TEAMS</SectionLabel>
          <div className="mt-5">
            <CfbHubBrowse browse={data.browse} total={data.totalTeams} />
          </div>
        </section>
      </div>
    </main>
  );
}
