import { APP_LEAGUES, joinList } from '@/lib/coverage-counts';
import type { Team, Promo, PromoType, Venue } from '@/lib/types';
import { PROMO_TYPE_LABELS } from '@/lib/types';
import {
  formatDateReadable,
  getPromosByType,
  getTopGiveaway,
  teamDisplayName,
} from '@/lib/promo-helpers';
import { RD_CATEGORIES } from '@/components/redesign/categories';

// Hardcoded, never derived from the clock. See the same rule at
// generateTeamFAQs in promo-helpers.ts: the page title and meta description
// already hardcode 2026, so a getFullYear() here flips this copy to the next
// season at midnight on Jan 1, months before that season's data exists, and
// leaves one page asserting two different years.
const SEASON_YEAR = 2026;

// "Sep 12". Deliberately shorter than formatDateReadable's "September 12": the
// theme-night paragraph carries up to three of these inside one snippet-length
// sentence, and the long month name spends the budget without adding meaning.
// Noon local avoids the UTC-midnight off-by-one that shifts a date back a day.
function monthDayShort(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}


const APP_LEAGUE_LIST = joinList(APP_LEAGUES);

interface TeamContentSectionsProps {
  team: Team;
  promos: Promo[];
  venue: Venue | null;
  promoCounts: Record<PromoType, number>;
  variant?: 'dark' | 'light';
}

export function TeamContentSections({
  team,
  promos,
  venue,
  promoCounts,
  variant = 'dark',
}: TeamContentSectionsProps) {
  const year = SEASON_YEAR;
  const fullName = teamDisplayName(team);
  const venueName = venue?.name || 'their home stadium';
  // The app covers APP_LEAGUES only; the plug names it on those pages and the
  // weekly email everywhere else, on all 169 pages and both variants.
  const inApp = (APP_LEAGUES as readonly string[]).includes(team.league);

  if (variant === 'light') {
    return (
      <section className="py-10">
        <div className="max-w-3xl mx-auto space-y-10">
          {/* Giveaways */}
          {promoCounts.giveaway > 0 && (
            <div>
              <LightSectionHeader category="giveaway">
                What giveaways are the {team.name} doing in {year}?
              </LightSectionHeader>
              <GiveawaySection
                team={team}
                promos={promos}
                venueName={venueName}
                count={promoCounts.giveaway}
                year={year}
                variant="light"
              />
            </div>
          )}

          {/* Theme Nights */}
          {promoCounts.theme > 0 && (
            <div>
              <LightSectionHeader category="theme">
                What are the best {team.name} theme nights in {year}?
              </LightSectionHeader>
              <ThemeSection
                team={team}
                promos={promos}
                venueName={venueName}
                count={promoCounts.theme}
                year={year}
                variant="light"
              />
            </div>
          )}

          {/* Food Deals */}
          {promoCounts.food > 0 && (
            <div>
              <LightSectionHeader category="food">
                What food deals does {venueName} offer?
              </LightSectionHeader>
              <FoodSection
                team={team}
                promos={promos}
                venueName={venueName}
                count={promoCounts.food}
                variant="light"
              />
            </div>
          )}

          {/* Kids Events */}
          {promoCounts.kids > 0 && (
            <div>
              <LightSectionHeader category="kids">
                When are {team.name} kids and family events in {year}?
              </LightSectionHeader>
              <KidsSection
                team={team}
                promos={promos}
                venueName={venueName}
                count={promoCounts.kids}
                year={year}
                variant="light"
              />
            </div>
          )}

          {/* PromoNight plug — always shown */}
          <div>
            <h2 className="rd-display text-2xl md:text-3xl text-rd-ink mb-4">
              How do I find {fullName} promotional events?
            </h2>
            <p className="text-rd-ink-soft text-sm leading-relaxed">
              {inApp
                ? `PromoNight tracks ${fullName} giveaways, theme nights, food deals and kids events in one place, free on this site. The free PromoNight app carries the same ${year} calendar on iOS and Android, and PromoNight Pro adds a morning-of reminder so you never miss a promotion at ${venueName}.`
                : `PromoNight tracks ${fullName} giveaways, theme nights, food deals and kids events in one place, free on this site. Star the ${fullName} here to get one weekly email with what is coming up at ${venueName}. The PromoNight app covers ${APP_LEAGUE_LIST} and does not carry ${team.league} yet.`}
            </p>
          </div>
        </div>
      </section>
    );
  }

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
            {inApp
                ? `PromoNight tracks ${fullName} giveaways, theme nights, food deals and kids events in one place, free on this site. The free PromoNight app carries the same ${year} calendar on iOS and Android, and PromoNight Pro adds a morning-of reminder so you never miss a promotion at ${venueName}.`
                : `PromoNight tracks ${fullName} giveaways, theme nights, food deals and kids events in one place, free on this site. Star the ${fullName} here to get one weekly email with what is coming up at ${venueName}. The PromoNight app covers ${APP_LEAGUE_LIST} and does not carry ${team.league} yet.`}
          </p>
        </div>
      </div>
    </section>
  );
}

function LightSectionHeader({
  category,
  children,
}: {
  category: PromoType;
  children: React.ReactNode;
}) {
  const { color, Icon, ink } = RD_CATEGORIES[category];
  return (
    <div className="flex items-start gap-3 mb-4">
      <span
        className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${color}1a`, color: ink }}
      >
        <Icon size={18} stroke={2.25} />
      </span>
      <h2 className="rd-display text-2xl md:text-3xl text-rd-ink">{children}</h2>
    </div>
  );
}

function GiveawaySection({
  team,
  promos,
  venueName,
  count,
  year,
  variant = 'dark',
}: {
  team: Team;
  promos: Promo[];
  venueName: string;
  count: number;
  year: number;
  variant?: 'dark' | 'light';
}) {
  const fullName = teamDisplayName(team);
  const giveaways = getPromosByType(promos, 'giveaway');
  const top = getTopGiveaway(promos);

  if (variant === 'light') {
    return (
      <div className="text-rd-ink-soft text-sm leading-relaxed space-y-3">
        <p>
          The {fullName} have {count} giveaway night{count !== 1 ? 's' : ''} scheduled for the {year} season at {venueName}.
          {top
            ? ` Highlights include ${top.title} on ${formatDateReadable(top.date)}${top.opponent ? ` against the ${top.opponent}` : ''}.`
            : ''}
        </p>
        <ul className="space-y-1.5 list-disc list-inside text-rd-ink-soft">
          {giveaways.slice(0, 6).map((p, i) => (
            <li key={i}>
              <span className="text-rd-ink font-medium">{formatDateReadable(p.date)}</span> · {p.title}
              {p.opponent ? ` (vs ${p.opponent})` : ''}
            </li>
          ))}
          {giveaways.length > 6 && (
            <li className="text-rd-ink-faint">
              ...and {giveaways.length - 6} more giveaway{giveaways.length - 6 !== 1 ? 's' : ''}
            </li>
          )}
        </ul>
      </div>
    );
  }

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
            <span className="text-white font-medium">{formatDateReadable(p.date)}</span> · {p.title}
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
  variant = 'dark',
}: {
  team: Team;
  promos: Promo[];
  venueName: string;
  count: number;
  year: number;
  variant?: 'dark' | 'light';
}) {
  const fullName = teamDisplayName(team);
  const themes = getPromosByType(promos, 'theme');

  // ONE paragraph, built once and rendered by BOTH variants below. It used to
  // be two independent hardcoded copies, and both closed with the same
  // boilerplate second sentence about entertainment, merchandise and game-day
  // experiences, byte-identical on all 30 MLB teams. Google extracts this
  // paragraph for the snippet on the "{team} theme nights" query family, so
  // that sentence was spending the snippet saying nothing team-specific. It is
  // replaced by the next three theme nights, named and dated, from the same
  // array the <ul> below renders. The old sentence is deliberately not quoted
  // here: it should not survive a repo grep in any form.
  //
  // The paragraph lives here rather than in each branch so the old sentence
  // cannot survive on a second render path: the redesign passes variant="light"
  // and is the live path today, but the dark branch is still reachable with the
  // redesign gate off.
  //
  // UPCOMING-ness is the caller's contract, exactly as it already is for
  // `count`: both call sites (the redesign template and the legacy team route)
  // pass upcomingPromos / upcomingCounts. Dates are filtered here regardless,
  // because a dateless recurring row cannot be named as "next up" and would
  // render an invalid date.
  const nextUp = themes
    .filter((p) => typeof p.date === 'string' && p.date !== '')
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);
  // When nothing is scheduled the sentence is OMITTED, not softened. No filler,
  // no "none scheduled": absence beats a wrong or empty claim.
  const themeParagraph =
    `The ${fullName} have ${count} theme night${count !== 1 ? 's' : ''} scheduled at ${venueName} during the ${year} season.` +
    (nextUp.length > 0
      ? ` Next up: ${nextUp.map((p) => `${p.title} (${monthDayShort(p.date)})`).join(', ')}.`
      : '');

  if (variant === 'light') {
    return (
      <div className="text-rd-ink-soft text-sm leading-relaxed space-y-3">
        <p>{themeParagraph}</p>
        <ul className="space-y-1.5 list-disc list-inside text-rd-ink-soft">
          {themes.slice(0, 6).map((p, i) => (
            <li key={i}>
              <span className="text-rd-ink font-medium">{formatDateReadable(p.date)}</span> · {p.title}
              {p.opponent ? ` (vs ${p.opponent})` : ''}
            </li>
          ))}
          {themes.length > 6 && (
            <li className="text-rd-ink-faint">
              ...and {themes.length - 6} more theme night{themes.length - 6 !== 1 ? 's' : ''}
            </li>
          )}
        </ul>
      </div>
    );
  }

  return (
    <div className="text-text-secondary text-sm leading-relaxed space-y-3">
      <p>{themeParagraph}</p>
      <ul className="space-y-1.5 list-disc list-inside text-text-secondary">
        {themes.slice(0, 6).map((p, i) => (
          <li key={i}>
            <span className="text-white font-medium">{formatDateReadable(p.date)}</span> · {p.title}
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
  variant = 'dark',
}: {
  team: Team;
  promos: Promo[];
  venueName: string;
  count: number;
  variant?: 'dark' | 'light';
}) {
  const fullName = teamDisplayName(team);
  const foodDeals = getPromosByType(promos, 'food');

  if (variant === 'light') {
    return (
      <div className="text-rd-ink-soft text-sm leading-relaxed space-y-3">
        <p>
          {venueName} has {count} food deal event{count !== 1 ? 's' : ''} during {fullName} games. These include discounted concessions, pregame specials, and recurring weekly deals.
        </p>
        <ul className="space-y-1.5 list-disc list-inside text-rd-ink-soft">
          {foodDeals.slice(0, 6).map((p, i) => (
            <li key={i}>
              <span className="text-rd-ink font-medium">{formatDateReadable(p.date)}</span> · {p.title}
            </li>
          ))}
          {foodDeals.length > 6 && (
            <li className="text-rd-ink-faint">
              ...and {foodDeals.length - 6} more food deal{foodDeals.length - 6 !== 1 ? 's' : ''}
            </li>
          )}
        </ul>
      </div>
    );
  }

  return (
    <div className="text-text-secondary text-sm leading-relaxed space-y-3">
      <p>
        {venueName} has {count} food deal event{count !== 1 ? 's' : ''} during {fullName} games. These include discounted concessions, pregame specials, and recurring weekly deals.
      </p>
      <ul className="space-y-1.5 list-disc list-inside text-text-secondary">
        {foodDeals.slice(0, 6).map((p, i) => (
          <li key={i}>
            <span className="text-white font-medium">{formatDateReadable(p.date)}</span> · {p.title}
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
  variant = 'dark',
}: {
  team: Team;
  promos: Promo[];
  venueName: string;
  count: number;
  year: number;
  variant?: 'dark' | 'light';
}) {
  const fullName = teamDisplayName(team);
  const kidsEvents = getPromosByType(promos, 'kids');

  if (variant === 'light') {
    return (
      <div className="text-rd-ink-soft text-sm leading-relaxed space-y-3">
        <p>
          The {fullName} have {count} kids and family event{count !== 1 ? 's' : ''} at {venueName} in {year}. Family events are designed to make game day fun for fans of all ages.
        </p>
        <ul className="space-y-1.5 list-disc list-inside text-rd-ink-soft">
          {kidsEvents.slice(0, 6).map((p, i) => (
            <li key={i}>
              <span className="text-rd-ink font-medium">{formatDateReadable(p.date)}</span> · {p.title}
            </li>
          ))}
          {kidsEvents.length > 6 && (
            <li className="text-rd-ink-faint">
              ...and {kidsEvents.length - 6} more family event{kidsEvents.length - 6 !== 1 ? 's' : ''}
            </li>
          )}
        </ul>
      </div>
    );
  }

  return (
    <div className="text-text-secondary text-sm leading-relaxed space-y-3">
      <p>
        The {fullName} have {count} kids and family event{count !== 1 ? 's' : ''} at {venueName} in {year}. Family events are designed to make game day fun for fans of all ages.
      </p>
      <ul className="space-y-1.5 list-disc list-inside text-text-secondary">
        {kidsEvents.slice(0, 6).map((p, i) => (
          <li key={i}>
            <span className="text-white font-medium">{formatDateReadable(p.date)}</span> · {p.title}
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
