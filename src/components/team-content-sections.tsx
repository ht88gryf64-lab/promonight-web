import type { Team, Promo, PromoType, Venue } from '@/lib/types';
import { PROMO_TYPE_LABELS } from '@/lib/types';
import {
  getCurrentYear,
  formatDateReadable,
  getPromosByType,
  getTopGiveaway,
} from '@/lib/promo-helpers';

interface TeamContentSectionsProps {
  team: Team;
  promos: Promo[];
  venue: Venue | null;
  promoCounts: Record<PromoType, number>;
}

export function TeamContentSections({
  team,
  promos,
  venue,
  promoCounts,
}: TeamContentSectionsProps) {
  const year = getCurrentYear();
  const fullName = `${team.city} ${team.name}`;
  const venueName = venue?.name || 'their home stadium';

  return (
    <section className="py-12 px-6 border-t border-border-subtle">
      <div className="max-w-3xl mx-auto space-y-10">
        {/* Giveaways */}
        {promoCounts.giveaway > 0 && (
          <div>
            <h2 className="font-display text-2xl md:text-3xl tracking-[1px] mb-4">
              What giveaways are the {team.name} doing in {year}?
            </h2>
            <GiveawaySection
              team={team}
              promos={promos}
              venueName={venueName}
              count={promoCounts.giveaway}
              year={year}
            />
          </div>
        )}

        {/* Theme Nights */}
        {promoCounts.theme > 0 && (
          <div>
            <h2 className="font-display text-2xl md:text-3xl tracking-[1px] mb-4">
              What are the best {team.name} theme nights in {year}?
            </h2>
            <ThemeSection
              team={team}
              promos={promos}
              venueName={venueName}
              count={promoCounts.theme}
              year={year}
            />
          </div>
        )}

        {/* Food Deals */}
        {promoCounts.food > 0 && (
          <div>
            <h2 className="font-display text-2xl md:text-3xl tracking-[1px] mb-4">
              What food deals does {venueName} offer?
            </h2>
            <FoodSection
              team={team}
              promos={promos}
              venueName={venueName}
              count={promoCounts.food}
            />
          </div>
        )}

        {/* Kids Events */}
        {promoCounts.kids > 0 && (
          <div>
            <h2 className="font-display text-2xl md:text-3xl tracking-[1px] mb-4">
              When are {team.name} kids and family events in {year}?
            </h2>
            <KidsSection
              team={team}
              promos={promos}
              venueName={venueName}
              count={promoCounts.kids}
              year={year}
            />
          </div>
        )}

        {/* PromoNight plug — always shown */}
        <div>
          <h2 className="font-display text-2xl md:text-3xl tracking-[1px] mb-4">
            How do I find {fullName} promotional events?
          </h2>
          <p className="text-text-secondary text-sm leading-relaxed">
            PromoNight is a free app that tracks every {fullName} giveaway, theme night, food deal, and kids event in one place. Download PromoNight on iOS or Android to browse the full {year} promo calendar, set push notifications for your favorite events, and never miss a promotion at {venueName}.
          </p>
        </div>
      </div>
    </section>
  );
}

function GiveawaySection({
  team,
  promos,
  venueName,
  count,
  year,
}: {
  team: Team;
  promos: Promo[];
  venueName: string;
  count: number;
  year: number;
}) {
  const fullName = `${team.city} ${team.name}`;
  const giveaways = getPromosByType(promos, 'giveaway');
  const top = getTopGiveaway(promos);

  return (
    <div className="text-text-secondary text-sm leading-relaxed space-y-3">
      <p>
        The {fullName} have {count} giveaway night{count !== 1 ? 's' : ''} scheduled for the {year} season at {venueName}.
        {top
          ? ` Highlights include ${top.title} on ${formatDateReadable(top.date)}${top.opponent ? ` against the ${top.opponent}` : ''}.`
          : ''}
      </p>
      <ul className="space-y-1.5 list-disc list-inside text-text-secondary">
        {giveaways.slice(0, 6).map((p, i) => (
          <li key={i}>
            <span className="text-white font-medium">{formatDateReadable(p.date)}</span> — {p.title}
            {p.opponent ? ` (vs ${p.opponent})` : ''}
          </li>
        ))}
        {giveaways.length > 6 && (
          <li className="text-text-muted">
            ...and {giveaways.length - 6} more giveaway{giveaways.length - 6 !== 1 ? 's' : ''}
          </li>
        )}
      </ul>
    </div>
  );
}

function ThemeSection({
  team,
  promos,
  venueName,
  count,
  year,
}: {
  team: Team;
  promos: Promo[];
  venueName: string;
  count: number;
  year: number;
}) {
  const fullName = `${team.city} ${team.name}`;
  const themes = getPromosByType(promos, 'theme');

  return (
    <div className="text-text-secondary text-sm leading-relaxed space-y-3">
      <p>
        The {fullName} have {count} theme night{count !== 1 ? 's' : ''} scheduled at {venueName} during the {year} season. Theme nights include special entertainment, themed merchandise, and unique game-day experiences.
      </p>
      <ul className="space-y-1.5 list-disc list-inside text-text-secondary">
        {themes.slice(0, 6).map((p, i) => (
          <li key={i}>
            <span className="text-white font-medium">{formatDateReadable(p.date)}</span> — {p.title}
            {p.opponent ? ` (vs ${p.opponent})` : ''}
          </li>
        ))}
        {themes.length > 6 && (
          <li className="text-text-muted">
            ...and {themes.length - 6} more theme night{themes.length - 6 !== 1 ? 's' : ''}
          </li>
        )}
      </ul>
    </div>
  );
}

function FoodSection({
  team,
  promos,
  venueName,
  count,
}: {
  team: Team;
  promos: Promo[];
  venueName: string;
  count: number;
}) {
  const fullName = `${team.city} ${team.name}`;
  const foodDeals = getPromosByType(promos, 'food');

  return (
    <div className="text-text-secondary text-sm leading-relaxed space-y-3">
      <p>
        {venueName} has {count} food deal event{count !== 1 ? 's' : ''} during {fullName} games. These include discounted concessions, pregame specials, and recurring weekly deals.
      </p>
      <ul className="space-y-1.5 list-disc list-inside text-text-secondary">
        {foodDeals.slice(0, 6).map((p, i) => (
          <li key={i}>
            <span className="text-white font-medium">{formatDateReadable(p.date)}</span> — {p.title}
          </li>
        ))}
        {foodDeals.length > 6 && (
          <li className="text-text-muted">
            ...and {foodDeals.length - 6} more food deal{foodDeals.length - 6 !== 1 ? 's' : ''}
          </li>
        )}
      </ul>
    </div>
  );
}

function KidsSection({
  team,
  promos,
  venueName,
  count,
  year,
}: {
  team: Team;
  promos: Promo[];
  venueName: string;
  count: number;
  year: number;
}) {
  const fullName = `${team.city} ${team.name}`;
  const kidsEvents = getPromosByType(promos, 'kids');

  return (
    <div className="text-text-secondary text-sm leading-relaxed space-y-3">
      <p>
        The {fullName} have {count} kids and family event{count !== 1 ? 's' : ''} at {venueName} in {year}. Family events are designed to make game day fun for fans of all ages.
      </p>
      <ul className="space-y-1.5 list-disc list-inside text-text-secondary">
        {kidsEvents.slice(0, 6).map((p, i) => (
          <li key={i}>
            <span className="text-white font-medium">{formatDateReadable(p.date)}</span> — {p.title}
          </li>
        ))}
        {kidsEvents.length > 6 && (
          <li className="text-text-muted">
            ...and {kidsEvents.length - 6} more family event{kidsEvents.length - 6 !== 1 ? 's' : ''}
          </li>
        )}
      </ul>
    </div>
  );
}
