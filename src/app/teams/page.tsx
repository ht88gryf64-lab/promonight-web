import type { Metadata } from 'next';
import { getAllTeams, getTeamPromos } from '@/lib/data';
import { TeamsBrowser } from '@/components/teams-browser';

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
