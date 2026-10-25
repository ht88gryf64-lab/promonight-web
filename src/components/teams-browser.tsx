'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Team } from '@/lib/types';
import { LEAGUE_ORDER, SPORT_ICONS } from '@/lib/types';
import { track } from '@/lib/analytics';
import { useStarredTeams } from '@/hooks/use-starred-teams';
import { isCfbHubLive } from '@/lib/league-hubs';
import { CfbConferenceSubRow } from '@/components/cfb/CfbConferenceSubRow';
import { StarToggle } from './star-toggle';
import { TeamCard } from './team-card';

// One league's block on the light /teams page: its divisions (or conferences)
// in hub order, as team ids into `teams`. Built on the server by
// src/app/teams/page.tsx from src/lib/hub-grouping.ts.
export interface TeamsBrowserSection {
  league: string;
  groups: { key: string; superGroup: string | null; teamIds: string[] }[];
}

interface TeamsBrowserProps {
  teams: Team[];
  promoCounts: Record<string, number>;
  // Light variant only. The dark browser keeps its single flat grid.
  sections?: TeamsBrowserSection[];
  // 'dark' (default) is the live browser, byte-identical when the gate is off.
  // 'light' re-skins the pills + swaps in the homepage's light TeamCard. Same
  // geo/star logic + the same teams_browser_view / team_picker_tab_change events;
  // the light cards additionally fire team_tile_tap (surface 'teams_page').
  variant?: 'dark' | 'light';
}

const ALL = 'All' as const;
// 'CFB' is a college-hub entry point, not a pro league: selecting it reveals the
// conference sub-row (which routes to /cfb), never filters pro cards, and CFB is
// never in the "All" total. Gated on the same registry `live` flag as the nav.
const CFB_CHIP = 'CFB' as const;
type ActiveLeague = typeof ALL | (typeof LEAGUE_ORDER)[number] | typeof CFB_CHIP;

// The ?league= subscription, quarantined in a null-rendering child so the
// useSearchParams static-generation bailout stops at ITS Suspense boundary
// instead of swallowing the browser: the 169-card grid must stay in the
// prerendered HTML. Reading window.location once on mount is not enough — a
// same-route client navigation (BrandBar "Teams" tap while a filter is
// active, back/forward) never remounts this tree, and the pill would desync
// from the URL.
function LeagueParamReader({ onParam }: { onParam: (param: string | null) => void }) {
  const league = useSearchParams().get('league');
  useEffect(() => {
    onParam(league);
  }, [league, onParam]);
  return null;
}

export function TeamsBrowser({ teams, promoCounts, sections = [], variant = 'dark' }: TeamsBrowserProps) {
  const light = variant === 'light';
  const cfbLive = isCfbHubLive();
  const [active, setActive] = useState<ActiveLeague>(ALL);
  const { starred, isHydrated } = useStarredTeams();
  const starredSet = useMemo(() => new Set(starred), [starred]);

  // URL -> state sync, reactive for the life of the page (arrival deep link,
  // same-route nav to bare /teams, back/forward, and the replaceState echo of
  // a pill tap). SSR and first client render stay All, so hydration matches
  // and the full grid stays in the prerendered HTML; a valid param flips the
  // pill right after. The sync never fires team_picker_tab_change (it is not
  // a user tap); the first invocation fires teams_browser_view with the
  // resolved arrival filter so dashboards can attribute /teams views
  // distinctly from /teams?league=X arrivals.
  const paramToLeague = useCallback(
    (param: string | null): ActiveLeague => {
      if (param && (LEAGUE_ORDER as readonly string[]).includes(param)) {
        return param as ActiveLeague;
      }
      if (param === CFB_CHIP && cfbLive) return CFB_CHIP;
      return ALL;
    },
    [cfbLive],
  );
  // An arrival ?league= is applied HERE, in a layout effect, not only through
  // LeagueParamReader. The hidden sections must lose `page-content` before
  // Raptive scans (known-issues entry 73), and only this ordering guarantees it.
  // LeagueParamReader's update comes from a passive effect, so React renders it
  // in a later task, and that task races the async ads.min.js. A layout-effect
  // update is synchronous: React finishes it before the hydration task ends,
  // flushing the passive effects first (RaptiveLoader only APPENDS the async
  // script there). Raptive's code therefore cannot run until the hidden
  // sections are already hidden and unanchored. The first render still
  // matches the server (All), and LeagueParamReader's first call becomes a
  // no-op setActive that still fires teams_browser_view.
  // It holds only while /teams hydrates in the same commit as RaptiveLoader: no
  // loading.tsx and no Suspense around the root layout's main element (known-issues entry 73, enforced
  // by src/lib/__tests__/teams-sections.test.ts).
  useLayoutEffect(() => {
    setActive(paramToLeague(new URLSearchParams(window.location.search).get('league')));
  }, [paramToLeague]);

  const viewFired = useRef(false);
  const syncFromParam = useCallback(
    (param: string | null) => {
      const league = paramToLeague(param);
      setActive(league);
      if (!viewFired.current) {
        viewFired.current = true;
        track('teams_browser_view', { league_filter: league });
      }
    },
    [paramToLeague],
  );

  // Filter and partition:
  //
  // 1. Apply the active league filter.
  // 2. Partition the filtered set into starred + unstarred, preserving
  //    each team's index from `teams` (which getAllTeams() ships sorted
  //    by league then city). Concatenating the partitions yields the
  //    historical natural order for zero-star users and "starred-first,
  //    natural order within partition" for starred users.
  //
  // Pre-hydration the starred set is empty by definition, so everything
  // lands in `unstarred` and the SSR + first-client-render produce
  // identical HTML (no hydration mismatch). After hydration the
  // partition re-runs with the real starred set, briefly reflowing the
  // grid for starred users.
  const filtered = useMemo(() => {
    const base = active === ALL ? teams : teams.filter((t) => t.league === active);
    const starredPart: Team[] = [];
    const unstarredPart: Team[] = [];
    for (const t of base) {
      if (isHydrated && starredSet.has(t.id)) {
        starredPart.push(t);
      } else {
        unstarredPart.push(t);
      }
    }
    return [...starredPart, ...unstarredPart];
  }, [teams, active, isHydrated, starredSet]);

  // Light layout: the starred teams, in natural order and under the active
  // league filter, for the "Your teams" row. Empty until hydration, so the
  // server HTML and the first client render agree.
  const yourTeams = useMemo(
    () =>
      isHydrated
        ? teams.filter((t) => starredSet.has(t.id) && (active === ALL || t.league === active))
        : [],
    [teams, active, isHydrated, starredSet],
  );
  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const lightCard = (team: Team, key: string) => (
    <TeamCard
      key={key}
      team={team}
      promoCount={promoCounts[team.id] ?? 0}
      countLabel="promos"
      tileSurface="teams_page"
      fromTab={active}
      starPlacement="teams_browser_card"
      sourcePage="teams"
      variant="light"
    />
  );

  const switchTab = (next: ActiveLeague) => {
    if (next === active) return;
    track('team_picker_tab_change', {
      surface: 'teams_page',
      from_league: active,
      to_league: next,
    });
    setActive(next);
    // Keep the URL in step with the pill so refresh, share, and back/forward
    // restore what the user is looking at. replaceState, not push: a filter
    // flip is not a new history entry. Next syncs this with useSearchParams,
    // which echoes through LeagueParamReader as a no-op setActive.
    window.history.replaceState(null, '', next === ALL ? '/teams' : `/teams?league=${next}`);
  };

  return (
    <div>
      <Suspense fallback={null}>
        <LeagueParamReader onParam={syncFromParam} />
      </Suspense>
      {/* League filter pills */}
      <div className="flex flex-wrap gap-2 mb-8">
        <FilterPill
          label={`All (${teams.length})`}
          active={active === ALL}
          onClick={() => switchTab(ALL)}
          light={light}
        />
        {LEAGUE_ORDER.map((league) => {
          const count = teams.filter((t) => t.league === league).length;
          return (
            <FilterPill
              key={league}
              label={`${league} (${count})`}
              active={active === league}
              onClick={() => switchTab(league)}
              light={light}
            />
          );
        })}
        {cfbLive && (
          <FilterPill
            label={CFB_CHIP}
            active={active === CFB_CHIP}
            onClick={() => switchTab(CFB_CHIP)}
            light={light}
          />
        )}
      </div>

      {light ? (
        <>
          {active === CFB_CHIP && <CfbConferenceSubRow surface="teams_page" light />}

          {yourTeams.length > 0 && active !== CFB_CHIP && (
            <section aria-labelledby="teams-yours" className="mb-14">
              <h2 id="teams-yours" className="rd-display text-2xl text-rd-ink md:text-3xl">
                Your teams
              </h2>
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {yourTeams.map((team) => lightCard(team, `yours-${team.id}`))}
              </div>
            </section>
          )}

          {/*
            Raptive's in-content anchors (known-issues entry 73). The root is an
            <article> ON PURPOSE: Raptive sizes in-content units from the tallest
            <article> (entry 49), and the divisions alone are a few hundred
            pixels each. Do not retag it to a <div>. Each league's
            `page-content` holds ONLY division groups, so every unit lands
            between two divisions or two leagues, never inside a card grid.
            Filtering toggles `hidden` and never unmounts: Raptive inserts its
            containers between these groups and does not rescan, so React must
            never re-order or remove a direct child of `page-content`.
          */}
          <article data-ad-region="content" className={active === CFB_CHIP ? 'hidden' : 'space-y-14'}>
            {sections.map((section) => {
              const shown = active === ALL || active === section.league;
              return (
                <section
                  key={section.league}
                  aria-labelledby={`teams-${section.league.toLowerCase()}`}
                  className={shown ? undefined : 'hidden'}
                >
                  <h2
                    id={`teams-${section.league.toLowerCase()}`}
                    className="rd-display text-2xl text-rd-ink md:text-3xl"
                  >
                    {section.league}
                  </h2>
                  {/* `page-content` only while the league is shown (entry 73): a
                      hidden section's groups would still be Raptive anchors, and
                      a unit filled inside display:none. A class change, never an
                      unmount, so Raptive's inserted nodes stay put. */}
                  <div className={shown && active !== CFB_CHIP ? 'page-content mt-6 space-y-8' : 'mt-6 space-y-8'}>
                    {section.groups.map((group) => (
                      <div key={group.key}>
                        <h3 className="rd-display text-base text-rd-ink">{groupLabel(group)}</h3>
                        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                          {group.teamIds.map((id) => {
                            const team = teamById.get(id);
                            return team ? lightCard(team, team.id) : null;
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </article>
        </>
      ) : active === CFB_CHIP ? (
        /* CFB: college-hub entry point (routes to /cfb), never inline pro cards. */
        <CfbConferenceSubRow surface="teams_page" />
      ) : (
        <>
          {/* Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filtered.map((team) => (
              <TeamBrowserCard
                key={team.id}
                team={team}
                promoCount={promoCounts[team.id] ?? 0}
              />
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-16">
              <p className="text-text-muted text-lg">No teams in this league.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// MLS and WNBA bucket by conference ("Eastern" / "Western"), with no super-header
// band, so the bare key would read as a direction. Divisions keep their key.
function groupLabel(group: TeamsBrowserSection['groups'][number]): string {
  return group.superGroup === null && (group.key === 'Eastern' || group.key === 'Western')
    ? `${group.key} Conference`
    : group.key;
}

function FilterPill({
  label,
  active,
  onClick,
  light = false,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  light?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        light
          ? `cursor-pointer rounded-full border px-4 py-1.5 font-rd text-[12px] font-semibold uppercase tracking-[0.08em] transition-colors ${
              active
                ? 'border-rd-ink bg-rd-ink text-white'
                : 'border-rd-line-strong bg-rd-card text-rd-ink-soft hover:border-rd-ink hover:text-rd-ink'
            }`
          : `cursor-pointer px-4 py-1.5 rounded-full text-[11px] font-mono tracking-[0.5px] uppercase transition-colors border ${
              active
                ? 'bg-accent-red text-white border-accent-red'
                : 'bg-transparent text-text-secondary border-border-subtle hover:border-border-hover'
            }`
      }
    >
      {label}
    </button>
  );
}

function TeamBrowserCard({
  team,
  promoCount,
}: {
  team: Team;
  promoCount: number;
}) {
  const hasPromos = promoCount > 0;
  const teamFullName = `${team.city} ${team.name}`;

  return (
    <article className="relative group bg-bg-card border border-border-subtle rounded-2xl overflow-hidden transition-all hover:-translate-y-0.5 hover:border-border-hover">
      <div
        className="h-[3px]"
        style={{
          background: `linear-gradient(90deg, ${team.primaryColor}, ${team.secondaryColor})`,
        }}
        aria-hidden="true"
      />
      <Link
        href={`/${team.sportSlug}/${team.id}`}
        className="block p-4 pr-12"
        aria-label={`${teamFullName} promo schedule`}
      >
        <div className="mb-3">
          <span
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono tracking-[1px] uppercase"
            style={{
              color: team.primaryColor,
              backgroundColor: `${team.primaryColor}15`,
              border: `1px solid ${team.primaryColor}30`,
            }}
          >
            {SPORT_ICONS[team.league]} {team.league}
          </span>
        </div>
        <div>
          <div className="text-text-secondary text-xs">{team.city}</div>
          <div className="font-outfit font-extrabold text-[17px] text-white leading-tight mt-0.5">
            {team.name}
          </div>
        </div>
        <div className="mt-3 text-[11px] font-mono">
          {hasPromos ? (
            <span className="text-[#34d399]">
              {promoCount} {promoCount === 1 ? 'promo' : 'promos'}
            </span>
          ) : (
            <span className="text-text-dim">No promos posted yet</span>
          )}
        </div>
      </Link>
      <div className="absolute top-2.5 right-2.5 z-10">
        <StarToggle
          teamSlug={team.id}
          teamName={teamFullName}
          league={team.league}
          sport={team.sportSlug}
          placement="teams_browser_card"
          surface="dark"
        />
      </div>
    </article>
  );
}
