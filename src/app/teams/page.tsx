import type { Metadata } from 'next';
import { getAllTeams, getTeamPromos } from '@/lib/data';
import { TeamSearch } from '@/components/team-search';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'All 167 Pro Sports Teams: Promo Calendars by League',
  description:
    '167 pro sports teams across MLB, NBA, NFL, NHL, MLS, and WNBA. Giveaways, theme nights, food deals, and kids days in one team directory.',
  alternates: { canonical: 'https://www.getpromonight.com/teams' },
};

export default async function TeamsPage() {
  const teams = await getAllTeams();

  const promoCounts: Record<string, number> = {};
  await Promise.all(
    teams.map(async (t) => {
      const promos = await getTeamPromos(t.id);
      promoCounts[t.id] = promos.length;
    })
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
          <p className="text-text-secondary mt-3 max-w-lg">
            Browse every team&apos;s promo schedule across MLB, NBA, NFL, NHL, MLS, and WNBA. Click a team to see all upcoming giveaways, theme nights, and deals.
          </p>
        </div>

        <TeamSearch teams={teams} promoCounts={promoCounts} />
      </div>
    </div>
  );
}
