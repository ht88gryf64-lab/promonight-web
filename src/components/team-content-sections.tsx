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
import { allCompletedClause } from '@/lib/season-label';
import type { ClaimMode } from '@/lib/season-scope';

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
  /** UPCOMING promos. The list population, and the whole population on the
   *  fallback path. */
  promos: Promo[];
  venue: Venue | null;
  promoCounts: Record<PromoType, number>;
  /** How to word the counts. Defaults to 'held', the pre-change rendering. */
  claim?: ClaimMode;
  variant?: 'dark' | 'light';
}

/**
 * What one section publishes, resolved once by the parent so the dark and light
 * branches cannot drift.
 *
 * THE SPLIT THAT MATTERS: `count` may be a SEASON total while `list` is always
 * a population the label names. Publishing a season count over a list of the
 * season's EARLIEST rows would put completed events under a heading asking what
 * the team is doing this year, which is the same label-versus-population defect
 * one level down. So the count comes from the season and the list comes from
 * what is still ahead, with its own label. Only when nothing is ahead does the
 * list fall back to completed rows, and it says so.
 */
interface SectionScope {
  /** The count to publish: season total where the season resolved. */
  count: number;
  /** How many of `count` are still ahead. Equals `count` on the fallback path. */
  upcomingCount: number;
  isSeason: boolean;
  /** True inside a league's rollout hold: render the PRE-CHANGE sentence. */
  held: boolean;
  year: number;
  /** Rows listed under the paragraph. */
  list: Promo[];
  /** True when `list` holds upcoming rows, false when it holds completed ones. */
  listIsUpcoming: boolean;
  /** Purchase-gating disclosure for a published season giveaway count. */
  gatedDisclosure: string | null;
}

export function TeamContentSections({
  team,
  promos,
  venue,
  promoCounts,
  claim = { kind: 'held' },
  variant = 'dark',
}: TeamContentSectionsProps) {
  const season = claim.kind === 'season' ? claim.scope : null;
  const held = claim.kind === 'held';
  const year = season ? season.year : SEASON_YEAR;
  const fullName = teamDisplayName(team);
  const venueName = venue?.name || 'their home stadium';

  const scopeFor = (type: PromoType): SectionScope => {
    if (!season) {
      return {
        count: promoCounts[type],
        upcomingCount: promoCounts[type],
        isSeason: false,
        held,
        year,
        list: getPromosByType(promos, type),
        listIsUpcoming: true,
        gatedDisclosure: null,
      };
    }
    const ahead = getPromosByType(season.upcoming, type);
    const done = getPromosByType(season.past, type);
    return {
      count: season.counts[type],
      upcomingCount: ahead.length,
      isSeason: true,
      held: false,
      year: season.year,
      list: ahead.length > 0 ? ahead : done,
      listIsUpcoming: ahead.length > 0,
      // Only the giveaway count is published broad enough to need it.
      gatedDisclosure: type === 'giveaway' ? season.gatedDisclosure : null,
    };
  };
  const scopes: Record<PromoType, SectionScope> = {
    giveaway: scopeFor('giveaway'),
    theme: scopeFor('theme'),
    food: scopeFor('food'),
    kids: scopeFor('kids'),
  };
  // The app covers APP_LEAGUES only; the plug names it on those pages and the
  // weekly email everywhere else, on all 169 pages and both variants.
  const inApp = (APP_LEAGUES as readonly string[]).includes(team.league);

  if (variant === 'light') {
    return (
      <section className="py-10">
        <div className="max-w-3xl mx-auto space-y-10">
          {/* Giveaways */}
          {scopes.giveaway.count > 0 && (
            <div>
              <LightSectionHeader category="giveaway">
                What giveaways are the {team.name} doing in {year}?
              </LightSectionHeader>
              <GiveawaySection
                team={team}
                upcoming={promos}
                venueName={venueName}
                scope={scopes.giveaway}
                variant="light"
              />
            </div>
          )}

          {/* Theme Nights */}
          {scopes.theme.count > 0 && (
            <div>
              <LightSectionHeader category="theme">
                What are the best {team.name} theme nights in {year}?
              </LightSectionHeader>
              <ThemeSection
                team={team}
                upcoming={promos}
                venueName={venueName}
                scope={scopes.theme}
                variant="light"
              />
            </div>
          )}

          {/* Food Deals */}
          {scopes.food.count > 0 && (
            <div>
              <LightSectionHeader category="food">
                What food deals does {venueName} offer?
              </LightSectionHeader>
              <FoodSection
                team={team}
                venueName={venueName}
                scope={scopes.food}
                variant="light"
              />
            </div>
          )}

          {/* Kids Events */}
          {scopes.kids.count > 0 && (
            <div>
              <LightSectionHeader category="kids">
                When are {team.name} kids and family events in {year}?
              </LightSectionHeader>
              <KidsSection
                team={team}
                venueName={venueName}
                scope={scopes.kids}
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
        {scopes.giveaway.count > 0 && (
          <div>
            <h2 className="font-display text-2xl md:text-3xl tracking-[1px] mb-4">
              What giveaways are the {team.name} doing in {year}?
            </h2>
            <GiveawaySection
              team={team}
              upcoming={promos}
              venueName={venueName}
              scope={scopes.giveaway}
            />
          </div>
        )}

        {/* Theme Nights */}
        {scopes.theme.count > 0 && (
          <div>
            <h2 className="font-display text-2xl md:text-3xl tracking-[1px] mb-4">
              What are the best {team.name} theme nights in {year}?
            </h2>
            <ThemeSection
              team={team}
              upcoming={promos}
              venueName={venueName}
              scope={scopes.theme}
            />
          </div>
        )}

        {/* Food Deals */}
        {scopes.food.count > 0 && (
          <div>
            <h2 className="font-display text-2xl md:text-3xl tracking-[1px] mb-4">
              What food deals does {venueName} offer?
            </h2>
            <FoodSection
              team={team}
              venueName={venueName}
              scope={scopes.food}
            />
          </div>
        )}

        {/* Kids Events */}
        {scopes.kids.count > 0 && (
          <div>
            <h2 className="font-display text-2xl md:text-3xl tracking-[1px] mb-4">
              When are {team.name} kids and family events in {year}?
            </h2>
            <KidsSection
              team={team}
              venueName={venueName}
              scope={scopes.kids}
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

/**
 * The line that names what the bullet list beneath it holds. Rendered whenever
 * a published count and its list describe different populations, which is every
 * season-scoped section. Without it a season count of 50 sits directly above six
 * upcoming rows and the reader reasonably reads the six as the fifty.
 */
function ListLabel({ scope, variant }: { scope: SectionScope; variant: 'dark' | 'light' }) {
  if (!scope.isSeason) return null;
  const text = scope.listIsUpcoming
    ? 'Still to come:'
    : `Completed in the ${scope.year} season:`;
  return (
    <p className={variant === 'light' ? 'text-rd-ink font-medium' : 'text-white font-medium'}>
      {text}
    </p>
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
  upcoming,
  venueName,
  scope,
  variant = 'dark',
}: {
  team: Team;
  /** UPCOMING promos, used only for the "highlights include" pick. */
  upcoming: Promo[];
  venueName: string;
  scope: SectionScope;
  variant?: 'dark' | 'light';
}) {
  const fullName = teamDisplayName(team);
  const giveaways = scope.list;
  // The highlight is chosen from UPCOMING rows on both paths. "Highlights
  // include" is a recommendation, and recommending a night that has already
  // happened is the one thing a season-scoped count must not licence.
  const top = getTopGiveaway(upcoming);
  const lead = scope.held
    ? `The ${fullName} have ${scope.count} giveaway night${scope.count !== 1 ? 's' : ''} scheduled for the ${scope.year} season at ${venueName}.`
    : scope.isSeason
    ? scope.upcomingCount > 0
      ? `The ${fullName} have ${scope.count} giveaway night${scope.count !== 1 ? 's' : ''} scheduled for the ${scope.year} season at ${venueName}, ${scope.upcomingCount} still to come.`
      : `The ${fullName} have ${scope.count} giveaway night${scope.count !== 1 ? 's' : ''} in the ${scope.year} season at ${venueName}. ${allCompletedClause(scope.count)}`
    : `The ${fullName} have ${scope.count} giveaway night${scope.count !== 1 ? 's' : ''} still to come at ${venueName}.`;

  if (variant === 'light') {
    return (
      <div className="text-rd-ink-soft text-sm leading-relaxed space-y-3">
        <p>
          {lead}
          {top
            ? ` Highlights include ${top.title} on ${formatDateReadable(top.date)}${top.opponent ? ` against the ${top.opponent}` : ''}.`
            : ''}
        </p>
        {scope.gatedDisclosure ? <p>{scope.gatedDisclosure}</p> : null}
        <ListLabel scope={scope} variant="light" />
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
        {lead}
        {top
          ? ` Highlights include ${top.title} on ${formatDateReadable(top.date)}${top.opponent ? ` against the ${top.opponent}` : ''}.`
          : ''}
      </p>
      {scope.gatedDisclosure ? <p>{scope.gatedDisclosure}</p> : null}
      <ListLabel scope={scope} variant="dark" />
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
  upcoming,
  venueName,
  scope,
  variant = 'dark',
}: {
  team: Team;
  /** UPCOMING promos, used only for the "Next up" pick. */
  upcoming: Promo[];
  venueName: string;
  scope: SectionScope;
  variant?: 'dark' | 'light';
}) {
  const fullName = teamDisplayName(team);
  const themes = scope.list;

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
  // "Next up" is drawn from UPCOMING rows on both paths, never from `scope.list`:
  // on a finished season that list holds completed nights, and naming one as
  // next up would be false. Empty when nothing is ahead, and the clause is then
  // omitted rather than softened.
  const nextUp = getPromosByType(upcoming, 'theme')
    .filter((p) => typeof p.date === 'string' && p.date !== '')
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);
  // When nothing is scheduled the sentence is OMITTED, not softened. No filler,
  // no "none scheduled": absence beats a wrong or empty claim.
  const themeLead = scope.held
    ? `The ${fullName} have ${scope.count} theme night${scope.count !== 1 ? 's' : ''} scheduled at ${venueName} during the ${scope.year} season.`
    : scope.isSeason
    ? scope.upcomingCount > 0
      ? `The ${fullName} have ${scope.count} theme night${scope.count !== 1 ? 's' : ''} scheduled at ${venueName} during the ${scope.year} season, ${scope.upcomingCount} still to come.`
      : `The ${fullName} have ${scope.count} theme night${scope.count !== 1 ? 's' : ''} at ${venueName} in the ${scope.year} season. ${allCompletedClause(scope.count)}`
    : `The ${fullName} have ${scope.count} theme night${scope.count !== 1 ? 's' : ''} still to come at ${venueName}.`;
  const themeParagraph =
    themeLead +
    (nextUp.length > 0
      ? ` Next up: ${nextUp.map((p) => `${p.title} (${monthDayShort(p.date)})`).join(', ')}.`
      : '');

  if (variant === 'light') {
    return (
      <div className="text-rd-ink-soft text-sm leading-relaxed space-y-3">
        <p>{themeParagraph}</p>
        <ListLabel scope={scope} variant="light" />
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
      <ListLabel scope={scope} variant="dark" />
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
  venueName,
  scope,
  variant = 'dark',
}: {
  team: Team;
  venueName: string;
  scope: SectionScope;
  variant?: 'dark' | 'light';
}) {
  const fullName = teamDisplayName(team);
  const foodDeals = scope.list;
  const foodLead = scope.held
    ? `${venueName} has ${scope.count} food deal event${scope.count !== 1 ? 's' : ''} during ${fullName} games.`
    : scope.isSeason
    ? scope.upcomingCount > 0
      ? `${venueName} has ${scope.count} food deal event${scope.count !== 1 ? 's' : ''} during ${fullName} games in the ${scope.year} season, ${scope.upcomingCount} still to come.`
      : `${venueName} has ${scope.count} food deal event${scope.count !== 1 ? 's' : ''} during ${fullName} games in the ${scope.year} season. ${allCompletedClause(scope.count)}`
    : `${venueName} has ${scope.count} food deal event${scope.count !== 1 ? 's' : ''} still to come during ${fullName} games.`;

  if (variant === 'light') {
    return (
      <div className="text-rd-ink-soft text-sm leading-relaxed space-y-3">
        <p>
          {foodLead} These include discounted concessions, pregame specials, and recurring weekly deals.
        </p>
        <ListLabel scope={scope} variant="light" />
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
        {foodLead} These include discounted concessions, pregame specials, and recurring weekly deals.
      </p>
      <ListLabel scope={scope} variant="dark" />
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
  venueName,
  scope,
  variant = 'dark',
}: {
  team: Team;
  venueName: string;
  scope: SectionScope;
  variant?: 'dark' | 'light';
}) {
  const fullName = teamDisplayName(team);
  const kidsEvents = scope.list;
  const kidsLead = scope.held
    ? `The ${fullName} have ${scope.count} kids and family event${scope.count !== 1 ? 's' : ''} at ${venueName} in ${scope.year}.`
    : scope.isSeason
    ? scope.upcomingCount > 0
      ? `The ${fullName} have ${scope.count} kids and family event${scope.count !== 1 ? 's' : ''} at ${venueName} in the ${scope.year} season, ${scope.upcomingCount} still to come.`
      : `The ${fullName} have ${scope.count} kids and family event${scope.count !== 1 ? 's' : ''} at ${venueName} in the ${scope.year} season. ${allCompletedClause(scope.count)}`
    : `The ${fullName} have ${scope.count} kids and family event${scope.count !== 1 ? 's' : ''} still to come at ${venueName}.`;

  if (variant === 'light') {
    return (
      <div className="text-rd-ink-soft text-sm leading-relaxed space-y-3">
        <p>
          {kidsLead} Family events are designed to make game day fun for fans of all ages.
        </p>
        <ListLabel scope={scope} variant="light" />
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
        {kidsLead} Family events are designed to make game day fun for fans of all ages.
      </p>
      <ListLabel scope={scope} variant="dark" />
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
