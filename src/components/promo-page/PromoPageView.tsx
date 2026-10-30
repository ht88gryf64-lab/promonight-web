import Link from 'next/link';
import type { ReactNode } from 'react';
import { archivoHouse } from '@/components/redesign/fonts-house';
import { TrackedAffiliateLink } from '@/components/tracked-affiliate-link';
import { TrackedAppLink } from '@/components/analytics-events';
import { AffiliateDisclosure } from '@/components/affiliates/AffiliateDisclosure';
import { getLeagueHub } from '@/lib/league-hubs';
import { buildSpotHeroUrl, buildTicketmasterUrl } from '@/lib/affiliates';
import { resolveHotelLink } from '@/lib/hotel-link';
import { downloadHref } from '@/lib/app-link';
import { promoAnchorId, teamDisplayName } from '@/lib/promo-helpers';
import { PROMO_TYPE_LABELS } from '@/lib/types';
import type { LinkedPromo, PromoPage, PromoPageContext } from '@/lib/promo-pages';
import {
  SITE_URL,
  badgeLabel,
  categoryAggregatorFor,
  cleanText,
  dateBlock,
  factTiles,
  formatInstantDate,
  formatLongDate,
  formatMonDay,
  pageImage,
  promoFaqs,
  promoPageDescription,
  promoPageIndexable,
  promoPageJsonLd,
  promoPagePath,
  promoPageTitle,
  quantityLine,
  YMD_RE,
  themeLabel,
  typeNoun,
  typePlural,
} from '@/lib/promo-page-copy';

// The per-promo page (Phase 3b, 2026-10-29). Spacing, type scale, tile shape
// and the CTA block follow docs/promo-page-mockup.html, drawn with the site's
// rd-* tokens (Archivo through .rd-display and .rd-numerals, the cream
// surface, white cards, brand red). The copy in the mockup is example data;
// every word here comes from the stored row and the team. ONE ORDER CHANGE
// from the mockup, by Gate A ruling (2026-10-29): the CTA row sits above the
// image, so the primary button clears the 390px fold with the image's
// height to spare. The order is breadcrumb, badge, H1, game line, CTA row,
// image, tiles, then the sections.
//
// THE ARTICLE IS THE AD WRAPPER (spec Raptive; the same rule as the playoffs
// pages). It is a real <article> with real height at every width, it carries
// page-content so its DIRECT CHILDREN are the ad anchors (".page-content > *",
// skip 2, insert after each remaining child), and nothing between it and the
// sections is display:contents. Every child below is a plain block with
// height; a section that would be empty is not rendered rather than rendered
// empty. No manual ad slots, no video: Raptive places the units.
//
// LINKS. Every internal anchor is the promo's name, the team's name or the
// building's name, never "View promo". The fixed set (breadcrumb, venue,
// category aggregator, the team's next promos and its page, the cross-team
// block, the previous edition) is what the guard test counts.

export const PROMO_PAGE_SURFACE = 'web_promo_page' as const;

export interface PromoPageViewProps {
  page: PromoPage;
  ctx: PromoPageContext;
  /** The site's day, the route's one clock read. */
  today: string;
}

/** The head values and the schema, from the same inputs the body renders. */
export function promoPageHead(page: PromoPage, ctx: PromoPageContext, today: string) {
  const { team, primary, dates } = page;
  const teamName = teamDisplayName(team);
  const removed = page.state === 'removed';
  // A duplicate under the canonical rule (page.canonicalSlug) points every
  // URL signal at its canonical: the link rel=canonical, og:url, and the
  // WebPage and Event url in the schema. It still renders its own body.
  const canonical = `${SITE_URL}${promoPagePath(team.sportSlug, team.id, page.canonicalSlug ?? page.slug)}`;
  const venueName = ctx.hub?.displayName ?? ctx.venue?.name ?? null;
  const title = promoPageTitle(primary.title, teamName, removed ? page.removedDates : dates, page.season);
  const description = promoPageDescription({
    description: primary.description,
    title: primary.title,
    teamName,
    opponentName: primary.displayOpponent,
    date: dates.length === 1 ? dates[0] : primary.date || null,
    venueName,
    removed,
  });
  const image = pageImage({ ...primary, updatedAt: page.updatedAt ?? primary.updatedAt }, team.id, teamName, primary.date || null);
  const imageUrl = image.kind === 'photo' ? image.url : `${SITE_URL}${image.url}`;
  const indexable = promoPageIndexable({ title: primary.title, dates: removed ? page.removedDates : dates, removed, today });
  return { teamName, canonical, title, description, image, imageUrl, indexable, venueName };
}

function ticketHref(page: PromoPage): string {
  const { team, primary } = page;
  return buildTicketmasterUrl({
    teamSlug: team.id,
    ticketmasterSlug: team.ticketmasterSlug,
    ticketmasterAttractionId: team.ticketmasterAttractionId,
    surface: PROMO_PAGE_SURFACE,
    promoId: primary.promoId,
  });
}

function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

const H2 = ({ children }: { children: ReactNode }) => <h2 className="rd-display m-0 text-[22px] uppercase text-rd-ink">{children}</h2>;

// The date is the tile; the subtitle never repeats it. A cross-team card
// names the club, a same-team card the opponent and the time (ruling
// 2026-10-29).
function PromoCard({ p, showTeam }: { p: LinkedPromo; showTeam: boolean }) {
  const d = dateBlock(p.date);
  const sub = showTeam ? p.teamName : [p.displayOpponent ? `vs ${p.displayOpponent}` : null, p.displayTime || null].filter(Boolean).join(' · ');
  return (
    <Link href={p.href} className="flex items-center gap-3 rounded-xl border border-rd-line bg-rd-card p-2.5 text-rd-ink no-underline transition-colors hover:border-rd-line-strong">
      <span className="w-11 shrink-0 text-center leading-none">
        <span className="block font-rd text-[10px] uppercase tracking-[0.1em] text-rd-ink-faint">{d.month}</span>
        <span className="rd-numerals block text-[20px]">{d.day}</span>
      </span>
      <span className="min-w-0 flex-1 text-[14px]">
        <span className="block font-semibold">{p.title}</span>
        {sub ? <span className="block text-[12px] text-rd-ink-faint">{sub}</span> : null}
      </span>
    </Link>
  );
}

export function PromoPageView({ page, ctx, today }: PromoPageViewProps) {
  const { team, primary, dates } = page;
  const removed = page.state === 'removed';
  const head = promoPageHead(page, ctx, today);
  const { teamName, canonical, image } = head;
  const multi = dates.length > 1;
  const teamHref = `/${team.sportSlug}/${team.id}`;
  const leagueHub = getLeagueHub(team.league);
  const leagueHref = leagueHub?.live ? leagueHub.href : null;
  const venueHref = ctx.hub && ctx.hub.indexable ? `/venues/${ctx.hub.slug}` : null;
  const venueName = head.venueName;
  const venueLine = [venueName, ctx.hub?.city ?? null].filter(Boolean).join(', ');
  const crumbHref = `${teamHref}#promo-${promoAnchorId({ date: primary.date, title: primary.title })}`;

  const badge = badgeLabel({ type: primary.type, tombstoned: removed, ticketPackageRequired: primary.ticketPackageRequired });
  const quantity = removed ? null : quantityLine(primary);
  const tiles = removed ? [] : factTiles(primary);
  const aggregator = categoryAggregatorFor(primary, team.league);
  const removedOn = formatInstantDate(page.removedAt);
  const faqs = promoFaqs({ row: primary, teamName, dates, removed, removedOn });
  const sourceHost = hostOf(primary.sourceUrl);
  const readOn = formatInstantDate(ctx.observedAt);
  const description = cleanText(primary.description);

  const tickets = ticketHref(page);
  const parking = buildSpotHeroUrl({ latitude: ctx.coords?.lat, longitude: ctx.coords?.lng, subKey: `${PROMO_PAGE_SURFACE}_${team.id}` });
  const hotels = resolveHotelLink({ team, venue: ctx.venue, surface: PROMO_PAGE_SURFACE, gameDate: multi ? null : primary.date || null });

  const theme = themeLabel(primary.themeKey);
  const crossTeam = ctx.crossTeam?.links ?? [];
  const crossHeading =
    ctx.crossTeam?.kind === 'theme'
      ? 'Same promo, other teams'
      : ctx.crossTeam?.kind === 'league-type'
        ? `More ${team.league} ${typePlural(primary.type)} coming up`
        : ctx.crossTeam?.kind === 'league'
          ? `More ${team.league} promos coming up`
          : `More ${typePlural(primary.type)} across pro sports`;
  const crossSub = ctx.crossTeam?.kind === 'theme' && theme ? `${theme} at other clubs this season` : null;

  const jsonLd = promoPageJsonLd({
    canonical,
    title: head.title,
    description: head.description,
    promoName: cleanText(primary.title),
    teamName,
    rows: removed ? page.removedRows : page.rows,
    removed,
    imageUrl: head.imageUrl,
    location: ctx.location,
    ticketUrl: tickets,
    dateModified: page.updatedAt,
    faqs,
    // The visible trail, item for item (Google asks the markup to reflect it):
    // league hub, team page, the team's promos (its anchor on the team page).
    breadcrumbs: [
      { name: team.league, url: `${SITE_URL}${leagueHref ?? '/'}` },
      { name: teamName, url: `${SITE_URL}${teamHref}` },
      { name: 'Promos', url: `${SITE_URL}${crumbHref}` },
    ],
  });

  // A single-date page names the opponent once, in the matchup line above the
  // date; a series names it per date (ruling 2026-10-29).
  const gameLine = (date: string, row: { displayTime: string; displayOpponent: string }, key: string, withOpponent: boolean) => (
    <li key={key} className="m-0 list-none text-[15px] leading-[1.45] text-rd-ink-soft">
      <strong className="text-rd-ink">{`${formatLongDate(date)}${row.displayTime ? ` · ${row.displayTime}` : ''}`}</strong>
      {withOpponent && row.displayOpponent ? <span className="block">{`vs ${row.displayOpponent}`}</span> : null}
    </li>
  );
  // A series shows three dates and folds the rest into a native expander (no
  // script, every date in the HTML), so the CTA row follows a short list: the
  // next three, padded with the most recent played dates when fewer than
  // three remain. The fold says "earlier" when everything in it has been
  // played. The full list stays in the FAQ and in the per-date Events. Only
  // dated rows, the same filter the Events use.
  const datedRows = page.rows.filter((r) => YMD_RE.test(r.date));
  const upcomingRows = datedRows.filter((r) => r.date >= today);
  const playedRows = datedRows.filter((r) => r.date < today);
  const nextRows = upcomingRows.slice(0, 3);
  const shownRows = [...playedRows.slice(Math.max(0, playedRows.length - (3 - nextRows.length))), ...nextRows];
  const shownIds = new Set(shownRows.map((r) => r.promoId));
  const foldedRows = datedRows.filter((r) => !shownIds.has(r.promoId));
  const foldedAllPlayed = foldedRows.length > 0 && foldedRows.every((r) => r.date < today);
  const foldLabel = `+${foldedRows.length} ${foldedAllPlayed ? 'earlier' : 'more'} date${foldedRows.length === 1 ? '' : 's'}`;

  return (
    <div className={`${archivoHouse.variable} rd-root min-h-screen`}>
      {jsonLd.map((s, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />
      ))}
      <article className="page-content mx-auto w-full max-w-[640px] px-4 pb-10 lg:max-w-3xl" data-ad-region="content">
        <nav aria-label="Breadcrumb" className="flex flex-wrap gap-1.5 pt-3.5 text-[12px] text-rd-ink-faint">
          {leagueHref ? (
            <Link href={leagueHref} className="no-underline hover:text-rd-ink">{team.league}</Link>
          ) : (
            <span>{team.league}</span>
          )}
          <span aria-hidden="true">/</span>
          <Link href={teamHref} className="no-underline hover:text-rd-ink">{team.name}</Link>
          <span aria-hidden="true">/</span>
          <Link href={crumbHref} className="no-underline hover:text-rd-ink">Promos</Link>
        </nav>

        <header className="flex flex-col gap-2.5 pt-3">
          <div className="flex items-center gap-2">
            <span className={`rounded-md px-2 py-1 font-rd text-[11px] font-semibold uppercase tracking-[0.12em] text-white ${removed ? 'bg-rd-ink-soft' : 'bg-rd-red'}`}>{badge}</span>
            {quantity ? <span className="font-rd text-[11px] font-semibold uppercase tracking-[0.12em] text-rd-ink-faint">{quantity}</span> : null}
          </div>
          <h1 className="rd-display m-0 text-[40px] uppercase leading-[0.95] tracking-[-0.01em] text-rd-ink">{cleanText(primary.title) || 'Untitled promotion'}</h1>
          {removed ? (
            <p className="m-0 text-[15px] leading-[1.45] text-rd-ink-soft">
              <strong className="text-rd-ink">{`Removed from the ${teamName} schedule${removedOn ? ` on ${removedOn}` : ''}.`}</strong>
            </p>
          ) : null}
          {!multi ? (
            <p className="m-0 text-[15px] leading-[1.45] text-rd-ink-soft">{`${teamName}${primary.displayOpponent ? ` vs ${primary.displayOpponent}` : ''}`}</p>
          ) : null}
          {multi ? (
            <ul className="m-0 flex flex-col gap-1.5 p-0">
              {shownRows.map((r) => gameLine(r.date, r, r.promoId, true))}
            </ul>
          ) : primary.date ? (
            <ul className="m-0 p-0">{gameLine(primary.date, primary, primary.promoId, false)}</ul>
          ) : null}
          {multi && foldedRows.length ? (
            <details className="m-0">
              <summary className="cursor-pointer font-rd text-[14px] font-medium text-rd-red">{foldLabel}</summary>
              <ul className="m-0 mt-1.5 flex flex-col gap-1.5 p-0">
                {foldedRows.map((r) => gameLine(r.date, r, r.promoId, true))}
              </ul>
            </details>
          ) : null}
          {venueLine ? (
            <p className="m-0 text-[15px] leading-[1.45] text-rd-ink-soft">
              {venueHref ? <Link href={venueHref} className="text-rd-red no-underline hover:underline">{venueName}</Link> : venueName}
              {ctx.hub?.city ? <span>{`, ${ctx.hub.city}`}</span> : null}
              {/* A renamed building names its former name in the quick-facts
                  block; when that block has nothing to show, here instead. */}
              {ctx.formerNames.length && !ctx.quickFacts.length ? <span>{` · formerly ${ctx.formerNames.join(', ')}`}</span> : null}
            </p>
          ) : null}
        </header>

        {!removed ? (
          <section className="mt-4 flex flex-col gap-2.5">
            <TrackedAffiliateLink
              href={tickets}
              partner="ticketmaster"
              teamId={team.id}
              sport={team.league}
              promoId={primary.promoId}
              surface={PROMO_PAGE_SURFACE}
              placement="promo_page_primary"
              target="_blank"
              rel="noopener noreferrer sponsored"
              ariaLabel={multi ? `Get ${teamName} tickets on Ticketmaster` : `Get tickets for ${teamName}${primary.displayOpponent ? ` vs ${primary.displayOpponent}` : ''} on Ticketmaster`}
              className="flex h-[52px] items-center justify-center rounded-[14px] bg-rd-red font-rd text-[16px] font-semibold text-white no-underline hover:bg-rd-red-dark"
            >
              Get tickets
            </TrackedAffiliateLink>
            <div className="flex flex-wrap gap-2">
              <TrackedAffiliateLink
                href={parking}
                partner="spothero"
                teamId={team.id}
                sport={team.league}
                promoId={primary.promoId}
                surface={PROMO_PAGE_SURFACE}
                placement="promo_page_secondary"
                target="_blank"
                rel="noopener noreferrer sponsored"
                ariaLabel={`Reserve parking near ${venueName ?? teamName} on SpotHero`}
                className="flex h-11 min-w-[104px] flex-1 basis-0 items-center justify-center whitespace-nowrap rounded-xl border border-rd-line-strong bg-rd-card px-2 font-rd text-[14px] font-medium text-rd-ink no-underline hover:border-rd-ink"
              >
                Parking
              </TrackedAffiliateLink>
              {hotels ? (
                <TrackedAffiliateLink
                  href={hotels.href}
                  partner="expedia"
                  teamId={team.id}
                  sport={team.league}
                  promoId={primary.promoId}
                  surface={PROMO_PAGE_SURFACE}
                  placement="promo_page_secondary"
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  ariaLabel={`Find hotels near ${venueName ?? teamName} on Expedia`}
                  className="flex h-11 min-w-[104px] flex-1 basis-0 items-center justify-center whitespace-nowrap rounded-xl border border-rd-line-strong bg-rd-card px-2 font-rd text-[14px] font-medium text-rd-ink no-underline hover:border-rd-ink"
                >
                  Hotels
                </TrackedAffiliateLink>
              ) : null}
              <TrackedAppLink
                href={downloadHref(team.id)}
                platform="unknown"
                section="promo_page_cta"
                page="promo_page"
                teamSlug={team.id}
                plainAnchor
                className="flex h-11 min-w-[104px] flex-1 basis-0 items-center justify-center whitespace-nowrap rounded-xl border border-rd-line-strong bg-rd-card px-2 font-rd text-[14px] font-medium text-rd-ink no-underline hover:border-rd-ink"
              >
                Remind me
              </TrackedAppLink>
            </div>
          </section>
        ) : null}

        <figure className="m-0 mt-4 overflow-hidden rounded-2xl border border-rd-line bg-rd-card">
          {/* eslint-disable-next-line @next/next/no-img-element -- the tier 1 photo is a stored object whose dimensions are not on the row, and the card is served by our own route; next/image would add a second request and a remote-pattern entry for nothing. */}
          <img
            src={image.url}
            alt={image.alt}
            width={image.width ?? undefined}
            height={image.height ?? undefined}
            loading="eager"
            decoding="async"
            className={`block h-[220px] w-full bg-[#ebe4d6] ${image.kind === 'photo' ? 'object-contain' : 'object-cover'}`}
          />
          {image.kind === 'photo' ? (
            <figcaption className="px-3 py-2 font-rd text-[11px] text-rd-ink-faint">
              <span>{`${image.credit ?? `Image: ${teamName}`}${image.sourceUrl ? ' · ' : ''}`}</span>
              {image.sourceUrl ? <a href={image.sourceUrl} target="_blank" rel="noopener nofollow" className="text-rd-red">source</a> : null}
            </figcaption>
          ) : null}
        </figure>

        {tiles.length ? (
          <section className={`mt-4 grid gap-2 ${tiles.length === 3 ? 'grid-cols-3' : tiles.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {tiles.map((t) => (
              <div key={t.label} className="flex flex-col gap-0.5 rounded-xl border border-rd-line bg-rd-card p-2.5">
                <span className="font-rd text-[10px] uppercase tracking-[0.12em] text-rd-ink-faint">{t.label}</span>
                <span className={t.numeral ? 'rd-numerals text-[20px] text-rd-ink' : 'font-rd text-[16px] font-bold leading-[1.1] text-rd-ink'}>{t.value}</span>
              </div>
            ))}
          </section>
        ) : null}

        <section className="mt-6 flex flex-col gap-2">
          <H2>{`About this ${removed ? 'promotion' : typeNoun(primary.type)}`}</H2>
          {description ? <p className="m-0 text-[15px] leading-[1.55] text-rd-ink-soft">{description}</p> : null}
          {primary.ticketPackageRequired === true && primary.ticketPackageName ? (
            <p className="m-0 text-[15px] leading-[1.55] text-rd-ink-soft">Comes with the {cleanText(primary.ticketPackageName)} ticket package.</p>
          ) : null}
          <p className="m-0 font-rd text-[12px] text-rd-ink-faint">
            {primary.sourceUrl && sourceHost ? (
              <>
                {'Source: '}
                <a href={primary.sourceUrl} target="_blank" rel="noopener nofollow" className="text-rd-red">
                  {sourceHost}
                </a>
              </>
            ) : (
              <>Source: the team&rsquo;s published schedule</>
            )}
            {readOn ? <span>{` · read ${readOn}`}</span> : null}
          </p>
        </section>

        {ctx.alsoAtGame.length ? (
          <section className="mt-6 flex flex-col gap-2.5 rounded-2xl border border-rd-line bg-rd-card p-3.5">
            <H2>{`Also at ${multi ? 'these games' : 'this game'}`}</H2>
            <ul className="m-0 flex flex-col p-0">
              {ctx.alsoAtGame.map((p) => (
                <li key={p.href} className="list-none border-t border-rd-line">
                  <Link href={p.href} className="flex items-center justify-between gap-3 py-2 text-[15px] text-rd-ink no-underline hover:text-rd-red">
                    <span>{p.title}</span>
                    <span className="shrink-0 font-rd text-[12px] text-rd-ink-faint">{multi ? formatMonDay(p.date) : (PROMO_TYPE_LABELS[p.type] ?? '')}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {ctx.quickFacts.length && venueName ? (
          <section className="mt-6 flex flex-col gap-2.5 rounded-2xl border border-rd-line bg-rd-card p-3.5">
            <H2>{`${venueName}, quick facts`}</H2>
            {ctx.formerNames.length ? <p className="m-0 font-rd text-[12px] text-rd-ink-faint">{`Formerly ${ctx.formerNames.join(', ')}.`}</p> : null}
            <dl className="m-0 grid grid-cols-2 gap-2.5 text-[14px] text-rd-ink">
              {ctx.quickFacts.map((l) => (
                <div key={l.key}>
                  <dt className="font-rd text-[10px] uppercase tracking-[0.12em] text-rd-ink-faint">{l.label}</dt>
                  <dd className="m-0">
                    {l.text}
                    {l.href && l.hrefLabel ? (
                      <>
                        {' '}
                        <a href={l.href} target="_blank" rel="noopener noreferrer" className="text-rd-red">{l.hrefLabel}</a>
                      </>
                    ) : null}
                  </dd>
                </div>
              ))}
            </dl>
            {venueHref ? (
              <Link href={venueHref} className="font-rd text-[14px] font-medium text-rd-red no-underline hover:underline">{`${venueName} gameday guide`}</Link>
            ) : null}
          </section>
        ) : null}

        <section className="mt-6 flex flex-col gap-2.5">
          <H2>{`More ${team.name} ${ctx.nextTeamPromos.length && ctx.nextTeamPromos.every((p) => p.type === 'giveaway') ? 'giveaways' : 'promos'}`}</H2>
          {ctx.nextTeamPromos.map((p) => (
            <PromoCard key={p.href} p={p} showTeam={false} />
          ))}
          <p className="m-0 flex flex-wrap gap-x-4 gap-y-1 font-rd text-[14px] font-medium">
            <Link href={teamHref} className="text-rd-red no-underline hover:underline">{`All ${teamName} promos`}</Link>
            <Link href={aggregator.href} className="text-rd-red no-underline hover:underline">{aggregator.label}</Link>
          </p>
        </section>

        {crossTeam.length ? (
          <section className="mt-6 flex flex-col gap-2.5">
            <H2>{crossHeading}</H2>
            {crossSub ? <p className="m-0 font-rd text-[12px] text-rd-ink-faint">{crossSub}</p> : null}
            {crossTeam.map((p) => (
              <PromoCard key={p.href} p={p} showTeam />
            ))}
          </section>
        ) : null}

        {ctx.previousEdition ? (
          <section className="mt-6 flex flex-col gap-2">
            <H2>Previous edition</H2>
            <p className="m-0 text-[15px] leading-[1.45] text-rd-ink-soft">
              <Link href={ctx.previousEdition.href} className="font-medium text-rd-red no-underline hover:underline">{`${cleanText(primary.title)} ${ctx.previousEdition.season}`}</Link>
              <span>{` · ${formatLongDate(ctx.previousEdition.date)}`}</span>
            </p>
          </section>
        ) : null}

        {faqs.length ? (
          <section className="mt-6 flex flex-col gap-2">
            <H2>Questions</H2>
            {faqs.map((f) => (
              <details key={f.question} className="rounded-xl border border-rd-line bg-rd-card px-3.5 py-3">
                <summary className="cursor-pointer text-[14px] font-semibold text-rd-ink">{f.question}</summary>
                <p className="mb-0 mt-2 text-[14px] leading-[1.5] text-rd-ink-soft">{f.answer}</p>
              </details>
            ))}
          </section>
        ) : null}

        <AffiliateDisclosure className="mt-6" />
      </article>
    </div>
  );
}
