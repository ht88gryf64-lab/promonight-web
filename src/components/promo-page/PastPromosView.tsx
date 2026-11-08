import Link from 'next/link';
import { PromoCard } from '@/components/promo-rail/PromoCard';
import { getLeagueHub } from '@/lib/league-hubs';
import { teamDisplayName } from '@/lib/promo-helpers';
import { SITE_URL, cleanText } from '@/lib/promo-page-copy';
import type { ArchiveSeason } from '@/lib/promo-editions';
import { pastPromosPath } from '@/lib/promo-pages';
import { promoPageTheme, themeStyle } from '@/lib/promo-page-theme';
import type { Team } from '@/lib/types';
import type { CSSProperties } from 'react';

// The archive page (step 6, 2026-11-08): "{Team} past promos and
// giveaways", every played edition grouped by season, newest first, each
// row the rail's compact card (one Link through the promo page path).
// Breadcrumb league / team / Past promos. The article is the ad wrapper,
// as on the promo pages (page-content, direct children are the anchors).

export const PAST_PROMOS_CRUMB = 'Past promos';

export function pastPromosHead(team: Team, seasons: readonly ArchiveSeason[]) {
  const teamName = teamDisplayName(team);
  const count = seasons.reduce((n, s) => n + s.editions.length, 0);
  const oldest = seasons[seasons.length - 1]?.season ?? '';
  const newest = seasons[0]?.season ?? '';
  const span = oldest && newest && oldest !== newest ? `${oldest} to ${newest}` : newest;
  const title = `${teamName} past promos and giveaways`;
  // 100 to 155 characters on every club (the live battery's rule for a
  // promo-family URL): 115 for a three-letter club with one season, 150 for
  // a 22-letter club with a hundred promos across two season labels.
  const description = `Every ${teamName} promotion and giveaway already played, ${count} in all from ${span}, by season with each game's date and opponent.`;
  const canonical = `${SITE_URL}${pastPromosPath(team.sportSlug, team.id)}`;
  return { teamName, title, description, canonical, count };
}

export function PastPromosView({ team, seasons }: { team: Team; seasons: readonly ArchiveSeason[] }) {
  const { teamName, title, canonical, count } = pastPromosHead(team, seasons);
  const teamHref = `/${team.sportSlug}/${team.id}`;
  const leagueHub = getLeagueHub(team.league);
  const leagueHref = leagueHub?.live ? leagueHub.href : null;
  const palette = promoPageTheme(team);
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      ...(leagueHref ? [{ '@type': 'ListItem', position: 1, name: team.league, item: `${SITE_URL}${leagueHref}` }] : []),
      { '@type': 'ListItem', position: leagueHref ? 2 : 1, name: teamName, item: `${SITE_URL}${teamHref}` },
      { '@type': 'ListItem', position: leagueHref ? 3 : 2, name: PAST_PROMOS_CRUMB, item: canonical },
    ],
  };
  return (
    <article className="page-content mx-auto w-full max-w-[640px] px-4 pb-10 lg:max-w-3xl" data-ad-region="content" style={{ ...themeStyle(palette), overflowAnchor: 'none' } as CSSProperties}>
      <nav aria-label="Breadcrumb" className="flex flex-wrap gap-1.5 pt-3.5 text-[12px] text-rd-ink-faint">
        {leagueHref ? <Link href={leagueHref} className="no-underline hover:text-rd-ink">{team.league}</Link> : <span>{team.league}</span>}
        <span aria-hidden="true">/</span>
        <Link href={teamHref} className="no-underline hover:text-rd-ink">{teamName}</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page" className="text-rd-ink-soft">{PAST_PROMOS_CRUMB}</span>
      </nav>
      <header className="flex flex-col gap-2 pt-3">
        <h1 className="rd-display m-0 text-[30px] uppercase leading-[1.02] text-rd-ink">{title}</h1>
        <p className="m-0 font-rd text-[13px] text-rd-ink-soft">{`${count} ${count === 1 ? 'promotion' : 'promotions'} already played, newest first.`}</p>
      </header>
      {seasons.map((s) => (
        <section key={s.season} className="mt-6 flex flex-col gap-2.5">
          <h2 className="rd-display m-0 text-[22px] uppercase text-rd-ink">
            <span aria-hidden="true" className="mb-1.5 block h-[3px] w-10 rounded-full bg-[var(--pp-accent)]" />
            {`${s.season} season`}
          </h2>
          {s.editions.map((e) => (
            <PromoCard key={e.href} p={{ href: e.href, title: cleanText(e.title), date: e.date, teamName, displayOpponent: e.displayOpponent, displayTime: '' }} showTeam={false} />
          ))}
        </section>
      ))}
      <p className="mt-6 flex flex-wrap gap-x-4 gap-y-1 font-rd text-[14px] font-medium">
        <Link href={teamHref} className="text-rd-link no-underline hover:underline">{`All ${teamName} promos`}</Link>
      </p>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
    </article>
  );
}
