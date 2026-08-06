import type { Team } from '@/lib/types';
import { TeamCard } from '@/components/team-card';

// Same-division rivals grid for the team page: the cross-team links the page
// otherwise lacks (promo rows open modals, the schedule's expand is lazy).
// Rivals are derived server-side from gameContexts (lib/division-rivals.ts),
// so this renders only on leagues with game docs (MLB, NFL) and costs no
// extra reads. Cards omit promoCount on purpose: counts would need one
// getTeamPromos per rival, and the card hides the count line when undefined.
export interface DivisionRivalsProps {
  team: Team;
  rivals: Team[];
}

export function DivisionRivals({ team, rivals }: DivisionRivalsProps) {
  if (rivals.length === 0) return null;

  return (
    <section className="py-12 px-6">
      <div className="mx-auto max-w-5xl">
        <div className="font-rd text-[11px] uppercase tracking-[0.14em] text-rd-ink-faint">
          Around the division
        </div>
        <h2 className="rd-display mt-1 text-2xl text-rd-ink md:text-3xl">
          More {team.division} promo schedules
        </h2>
        <p className="mt-2 max-w-2xl font-rd text-sm leading-relaxed text-rd-ink-soft">
          Every {team.division} rival the {team.name} face this season, each with its own
          promo and giveaway calendar.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {rivals.map((rival) => (
            <TeamCard
              key={rival.id}
              team={rival}
              sourcePage="team_page"
              tileSurface="team_page"
              fromTab="division_rivals"
              starPlacement="team_page_rivals_card"
              variant="light"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
