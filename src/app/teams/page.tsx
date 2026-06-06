import type { Metadata } from 'next';
import { getAllTeams, getTeamPromos } from '@/lib/data';
import { TeamsBrowser } from '@/components/teams-browser';
import { isRedesignEnabled } from '@/lib/redesign';
import { archivoHouse } from '@/components/redesign/fonts-house';

export const revalidate = 86400;

// Description carries four distinct variables (count, league set, year,
// promo-type list) so the metadata three-variable rule holds without
// reusing copy from another page.
const TEAM_COUNT = 167;
const LEAGUE_SET = 'MLB, NBA, NHL, NFL, MLS, and WNBA';
const PROMO_TYPES =
  'bobblehead nights, jersey giveaways, theme nights, and food deals';

export const metadata: Metadata = {
  title: `Browse All ${TEAM_COUNT} Pro Sports Teams · Promo Calendars by League`,
  description: `Browse all ${TEAM_COUNT} pro sports teams across ${LEAGUE_SET} in ${new Date().getFullYear()}. Star your teams to follow ${PROMO_TYPES} as they're announced.`,
  alternates: { canonical: 'https://www.getpromonight.com/teams' },
};

export default async function TeamsPage() {
  const teams = await getAllTeams();

  const promoCounts: Record<string, number> = {};
  await Promise.all(
    teams.map(async (t) => {
      const promos = await getTeamPromos(t.id);
      promoCounts[t.id] = promos.length;
    }),
  );

  if (isRedesignEnabled()) {
    return (
      <div className={`${archivoHouse.variable} rd-root min-h-screen`}>
        <section className="relative overflow-hidden text-white" style={{ backgroundColor: '#1d1714' }}>
          <div
            aria-hidden
            className="absolute inset-0 z-0 opacity-60"
            style={{ backgroundImage: 'radial-gradient(120% 80% at 100% 0%, rgba(218,45,32,0.16) 0%, transparent 60%)' }}
          />
          <div className="relative z-10 mx-auto max-w-6xl px-6 pb-12 pt-16 md:pb-14 md:pt-20">
            <p className="font-rd text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
              Browse teams
            </p>
            <h1 className="rd-display mt-1 text-4xl uppercase leading-[0.95] text-white md:text-6xl">
              FIND YOUR TEAM
            </h1>
            <p className="mt-3 max-w-xl font-rd text-base text-white/65">
              {TEAM_COUNT} teams across {LEAGUE_SET}. Star your teams to follow their promos.
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-6xl px-6 pb-20 pt-10">
          <TeamsBrowser teams={teams} promoCounts={promoCounts} variant="light" />
        </div>
      </div>
    );
  }

  return (
    <div className="pt-28 pb-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-10">
          <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">
            Browse teams
          </span>
          <h1 className="font-display text-4xl md:text-6xl tracking-[1px] mt-2">
            FIND YOUR TEAM
          </h1>
          <p className="text-text-secondary mt-3 max-w-xl">
            Browse {TEAM_COUNT} teams across {LEAGUE_SET}. Star your teams to
            follow their promos.
          </p>
        </div>

        <TeamsBrowser teams={teams} promoCounts={promoCounts} />
      </div>
    </div>
  );
}
