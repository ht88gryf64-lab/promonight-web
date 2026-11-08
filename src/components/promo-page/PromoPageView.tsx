import Link from 'next/link';
import { Fragment, type CSSProperties, type ReactNode } from 'react';
import { TrackedAffiliateLink } from '@/components/tracked-affiliate-link';
import { TrackedAppLink } from '@/components/analytics-events';
import { PromoShareImageButton, PromoShareRowButton, ShareLandingCapture, type PromoShareProps } from '@/components/promo-page/PromoShare';
import { PromoShort } from '@/components/promo-page/PromoShort';
import { shortJsonLd } from '@/lib/youtube-shorts';
import { AffiliateDisclosure } from '@/components/affiliates/AffiliateDisclosure';
import { getLeagueHub } from '@/lib/league-hubs';
import { buildSpotHeroUrl, buildTicketmasterUrl, buildTicketNetworkLink, ticketNetworkForGame, ticketNetworkLinkLevel } from '@/lib/affiliates';
import { resolveHotelLink } from '@/lib/hotel-link';
import { promoDownloadHref } from '@/lib/app-link';
import { promoAnchorId, teamDisplayName } from '@/lib/promo-helpers';
import { PROMO_TYPE_LABELS } from '@/lib/types';
import { TICKET_PACKAGE_ROW_NOTE } from '@/lib/ticket-packages';
import type { LinkedPromo, PromoPage, PromoPageContext } from '@/lib/promo-pages';
import { EXPLAINER_LABEL, explainerFor } from '@/lib/promo-explainers';
import { BEFORE_YOU_GO_LABEL } from '@/lib/before-you-go';
import { promoPageTheme, themeStyle } from '@/lib/promo-page-theme';
import { dateTileState, ymdInZone, type DateTileState } from '@/lib/promo-date-tile';
import { promoRailItems } from '@/lib/promo-rail';
import { PromoRail } from '@/components/promo-rail/PromoRail';
import { PromoTypeSprite } from '@/components/promo-icons/PromoTypeIcon';
import { SeasonTimeline } from '@/components/promo-page/SeasonTimeline';
import type { ImageSize } from '@/lib/image-dimensions';
import {
  SITE_URL,
  CARD_HEIGHT,
  CARD_WIDTH,
  badgeLabel,
  categoryAggregatorFor,
  cleanText,
  dateBlock,
  formatInstantDate,
  formatLongDate,
  formatMonDay,
  formatMonDayYear,
  pageImage,
  promoFaqs,
  promoPageDescription,
  promoPageIndexable,
  promoPageJsonLd,
  promoPagePath,
  promoPageTitle,
  quantityLine,
  seasonLabelFor,
  shareCardOrigin,
  shareCardPath,
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
// THE CONTENT FLOOR (docs/per-promo-pages-v2-spec.md, build order 2,
// 2026-11-07). Team colour on the badge, the CTA, the band under the crumbs
// and the section rules (src/lib/promo-page-theme.ts, house red when a colour
// fails AA); the date tile beside the CTA column with its state line in the
// venue's zone (src/lib/promo-date-tile.ts); the sponsor as a line inside
// About (no tile); the authored explainer under "General guide"
// (src/lib/promo-explainers.ts, a themeKey entry, else a type entry, else no
// block); "This game", derived only, with every row optional; the library's
// FAQs after the stored-field FAQs. Still no sentence anywhere that is not a
// stored field, a count over stored fields, or a reviewed explainer file.
//
// LINKS. Every internal anchor is the promo's name, the team's name or the
// building's name, never "View promo". The fixed set (breadcrumb, venue,
// category aggregator, the team's next promos and its page, the cross-team
// block, the previous edition) is what the guard test counts.

export const PROMO_PAGE_SURFACE = 'web_promo_page' as const;
/** subId1 surface of the per-date "Tickets" links (TicketNetwork only). */
const PROMO_DATE_SUBID_SURFACE = 'web_promo_date' as const;

export interface PromoPageViewProps {
  page: PromoPage;
  ctx: PromoPageContext;
  /** The site's day, the route's one clock read. */
  today: string;
  /** The same read as an instant, for the date tile's state line in the
   *  venue's zone. Absent, the tile reads the site's day. */
  now?: Date;
  /** The stored photo's pixel size, read by the route (storedImageSize);
   *  the card's is fixed. */
  imageSize?: ImageSize | null;
}

/** The page's hero image, before the tier 1 photo's size is known. */
export function heroImage(page: PromoPage) {
  const { team, primary } = page;
  return pageImage({ ...primary, updatedAt: page.updatedAt ?? primary.updatedAt }, team.id, teamDisplayName(team), primary.date || null);
}

/** The head values and the schema, from the same inputs the body renders. */
export function promoPageHead(page: PromoPage, ctx: PromoPageContext, today: string, imageSize?: ImageSize | null) {
  const { team, primary, dates } = page;
  const teamName = teamDisplayName(team);
  const removed = page.state === 'removed';
  // A duplicate under the canonical rule (page.canonicalSlug) points every
  // URL signal at its canonical: the link rel=canonical, og:url, and the
  // WebPage and Event url in the schema. It still renders its own body.
  const canonical = `${SITE_URL}${promoPagePath(team.sportSlug, team.id, page.canonicalSlug ?? page.slug)}`;
  const venueName = ctx.hub?.displayName ?? ctx.venue?.name ?? null;
  // The cascade (ruling 2026-10-30) falls back to the club's nickname, then
  // the promo name alone, so the rendered title stays inside 60.
  const title = promoPageTitle(primary.title, teamName, removed ? page.removedDates : dates, page.season, team.name);
  const description = promoPageDescription({
    description: primary.description,
    title: primary.title,
    teamName,
    opponentName: primary.displayOpponent,
    date: dates.length === 1 ? dates[0] : primary.date || null,
    venueName,
    removed,
    type: primary.type,
    league: team.league,
    ticketPackage: primary.ticketPackageRequired === true,
    attendanceCap: primary.attendanceCap,
    whileSuppliesLast: primary.whileSuppliesLast,
    presentedBy: primary.presentedBy,
    displayTime: dates.length === 1 ? primary.displayTime : '',
  });
  const base = heroImage(page);
  const image = base.kind === 'photo' && imageSize ? { ...base, width: imageSize.width, height: imageSize.height } : base;
  const imageUrl = image.kind === 'photo' ? image.url : `${SITE_URL}${image.url}`;
  const indexable = promoPageIndexable({ title: primary.title, dates: removed ? page.removedDates : dates, removed, today });
  // The og:image (2026-11-03): the PromoNight share card, keyed on the page's
  // stamp. The Event schema keeps the tier image (imageUrl), unchanged.
  const shareCardDate = primary.date || null;
  const shareCard = {
    url: `${shareCardOrigin()}${shareCardPath(team.id, primary.promoId, page.updatedAt ?? primary.updatedAt)}`,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    alt: shareCardDate ? `${cleanText(primary.title)}: ${teamName}, ${formatMonDayYear(shareCardDate)}` : `${cleanText(primary.title)}: ${teamName}`,
  };
  return { teamName, canonical, title, description, image, imageUrl, indexable, venueName, shareCard };
}

function ticketHref(page: PromoPage): string {
  const { team, primary } = page;
  return buildTicketmasterUrl({
    teamSlug: team.id,
    ticketmasterSlug: team.ticketmasterSlug,
    ticketmasterAttractionId: team.ticketmasterAttractionId,
    surface: PROMO_PAGE_SURFACE,
    promoId: primary.promoId,
    pageSlug: page.slug,
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

// Every section heading carries a short rule in the team colour above it
// (spec Visuals 1, "section rules"); the rule is decoration, the text is the
// heading.
const H2 = ({ children }: { children: ReactNode }) => (
  <h2 className="rd-display m-0 text-[22px] uppercase text-rd-ink">
    <span aria-hidden="true" className="mb-1.5 block h-[3px] w-10 rounded-full bg-[var(--pp-accent)]" />
    {children}
  </h2>
);

/** The date tile (spec Visuals 2): weekday, the day large, the month, and the
 *  state line when the caller has one. `mini` is the series rail's shrunk
 *  tile. The numeral takes the accent only where it clears AA on the ground
 *  (--pp-accent-text is the ink otherwise). */
function DateTile({ ymd, state, size }: { ymd: string; state: DateTileState | null; size: 'full' | 'mini' }) {
  const d = dateBlock(ymd);
  const full = size === 'full';
  return (
    <div className={`flex shrink-0 flex-col items-center justify-center text-center ${full ? 'w-[92px] gap-0.5 rounded-2xl border border-rd-line bg-rd-card px-2 py-2.5' : 'w-[72px] rounded-xl border border-rd-line bg-rd-card px-1.5 py-1.5'}`}>
      <span className="font-rd text-[10px] uppercase tracking-[0.12em] text-rd-ink-faint">{d.weekday}</span>
      <span className={`rd-numerals leading-none text-[var(--pp-accent-text)] ${full ? 'text-[38px]' : 'text-[22px]'}`}>{String(Number(d.day))}</span>
      <span className="font-rd text-[10px] uppercase tracking-[0.12em] text-rd-ink-faint">{d.month}</span>
      {state ? (
        <span className={`mt-1 font-rd text-[10px] font-semibold uppercase leading-[1.3] tracking-[0.08em] ${state.kind === 'tonight' ? 'text-[var(--pp-accent-text)]' : 'text-rd-ink-soft'}`}>{state.label}</span>
      ) : null}
    </div>
  );
}

/** "2026-12" -> "December". */
function monthName(ym: string): string {
  return new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1)).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
}

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

export function PromoPageView({ page, ctx, today, now, imageSize }: PromoPageViewProps) {
  const { team, primary, dates } = page;
  const removed = page.state === 'removed';
  const head = promoPageHead(page, ctx, today, imageSize);
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
  // The team colour (one source: the team doc, as the card reads it), or the
  // house red when neither colour clears AA.
  const palette = promoPageTheme(team);
  // The authored guide for this kind of night, or null: themeKey, else type.
  const explainer = removed ? null : explainerFor({ themeKey: primary.themeKey, type: primary.type, title: primary.title, ticketPackageRequired: primary.ticketPackageRequired });
  const doors = cleanText(primary.gateOpenTime) || null;
  // The tile's "today" is the venue's day: the game's zone, else the
  // building's, else the site's (src/lib/promo-date-tile.ts). Only the
  // primary date's tile carries the door time.
  const venueToday = now ? ymdInZone(now, ctx.game?.timeZone) : today;
  const tileState = (d: string) => dateTileState(d, venueToday, d === primary.date ? doors : null);
  // PLAYED (ruling 2026-11-08): every date on the page is before today in
  // the venue's zone. A series with any date still to come is not played; a
  // removed page keeps its own state. The header says so, the ticket row
  // becomes the way forward (the team's next promo, the other editions),
  // the affiliate links go, the Events keep EventScheduled and drop their
  // offers, and the arrival question leaves the FAQ.
  const past = !removed && dates.length > 0 && dates.every((d) => d < venueToday);
  const nextPromoHref = ctx.nextTeamPromos[0]?.href ?? teamHref;
  const aggregator = categoryAggregatorFor(primary, team.league);
  const removedOn = formatInstantDate(page.removedAt);
  // Stored-field FAQs first, the library's after, in the visible block. The
  // FAQPage schema carries the stored-field FAQs ONLY (ruling 2026-11-07):
  // structured data states facts about this promotion, and a library FAQ is
  // general knowledge about its kind.
  const storedFaqs = promoFaqs({ row: primary, teamName, dates, removed, removedOn, past });
  const faqs = [...storedFaqs, ...(explainer?.faqs.map((f) => ({ question: f.q, answer: f.a })) ?? [])];
  const sourceHost = hostOf(primary.sourceUrl);
  const readOn = formatInstantDate(ctx.observedAt);
  const description = cleanText(primary.description);
  // The sponsor is a line inside About (spec item 5), unless the sourced
  // description already names it: never the same name twice in one block.
  const sponsor = cleanText(primary.presentedBy);
  const sponsorLine = sponsor && !description.toLowerCase().includes(sponsor.toLowerCase()) ? `Presented by ${sponsor}.` : null;
  // ABOUT (ruling 2026-11-07): the block renders only when it has sourced
  // prose to hold, the stored description or the package sentence every
  // package row carries (ruling 2026-10-24). Without either there is no
  // "About this" heading over a lone source line; the source credit (and the
  // sponsor line, when there is one) moves to a meta line under the venue
  // line in the header instead.
  const showAbout = !!description || primary.ticketPackageRequired === true;
  const sourceLine = (
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
  );

  // TICKETS (rulings 2026-11-02). The primary "Get tickets" is TicketNetwork:
  // the event page of the primary row's game when the pipeline matched it
  // (primary is the next upcoming date, so a series links its next game),
  // else the team performer page; subId1 web_promo_page_{team}. Ticketmaster
  // is the secondary text link. JSON-LD offers.url follows the primary href.
  // subId3 (ruling 2026-11-04) is page.slug on every Impact link here, the
  // per-date links and the Ticketmaster wrap included (withPageSubId3).
  const ticketmaster = ticketHref(page);
  // Only a date still to be played links its event (review round 2, H2): a
  // page whose dates have all been played keeps a live row as primary, and a
  // played game's event page has expired.
  const eventUrlOf = (r: { date: string; tnEventUrl?: string | null }) => (r.date >= today ? r.tnEventUrl ?? null : null);
  const primaryEventUrl = eventUrlOf(primary);
  // A club whose building TicketNetwork lists no events for (tnHomeUnavailable,
  // 2026-11-03: Maple Leafs, Raptors, Senators): Ticketmaster is the primary,
  // there is no "Also on" line, no per-date TicketNetwork link, and every
  // Event offers the Ticketmaster href. Ticketmaster tagging is unchanged.
  const tnAllowed = ticketNetworkForGame(null, team);
  const ticketNetwork = tnAllowed ? buildTicketNetworkLink({ team, surface: PROMO_PAGE_SURFACE, eventUrl: primaryEventUrl, pageSlug: page.slug }) : null;
  const tickets = ticketNetwork ?? ticketmaster;
  const ticketsPartner = ticketNetwork ? 'ticketnetwork' : 'ticketmaster';
  const ticketsLevel = ticketNetwork ? ticketNetworkLinkLevel(primaryEventUrl) : 'team';
  const ticketsBrand = ticketNetwork ? 'TicketNetwork' : 'Ticketmaster';
  const parking = buildSpotHeroUrl({ latitude: ctx.coords?.lat, longitude: ctx.coords?.lng, subKey: `${PROMO_PAGE_SURFACE}_${team.id}` });
  const hotels = resolveHotelLink({ team, venue: ctx.venue, surface: PROMO_PAGE_SURFACE, gameDate: multi ? null : primary.date || null });

  const theme = themeLabel(primary.themeKey);
  const crossTeam = ctx.crossTeam?.links ?? [];
  const crossHeading =
    ctx.crossTeam?.kind === 'theme'
      ? 'Same promo, other teams'
      : ctx.crossTeam?.kind === 'league-type'
        ? `More ${team.league} ${typePlural(primary.type, team.league)} coming up`
        : ctx.crossTeam?.kind === 'league'
          ? `More ${team.league} promos coming up`
          : `More ${typePlural(primary.type)} across pro sports`;
  const crossSub = ctx.crossTeam?.kind === 'theme' && theme ? `${theme} at other clubs this season` : null;

  // SHARE (2026-11-03). Stored fields only, the next date's game. Only these
  // strings cross into the client components (CLAUDE.md: every field handed
  // to a client component is published in the flight payload).
  const shareProps: PromoShareProps = {
    canonical,
    facts: { promoName: cleanText(primary.title) || 'Untitled promotion', teamName, displayOpponent: cleanText(primary.displayOpponent), date: primary.date },
    promoId: primary.promoId,
    team: team.id,
    league: team.league,
    pageSlug: page.slug,
  };

  const jsonLd = promoPageJsonLd({
    canonical,
    title: head.title,
    description: head.description,
    promoName: cleanText(primary.title),
    teamName,
    rows: removed ? page.removedRows : page.rows,
    removed,
    past,
    imageUrl: head.imageUrl,
    location: ctx.location,
    ticketUrl: tickets,
    // Each date's Event offers that date's own game: the event page when the
    // pipeline matched it and the date is still to be played, else the team
    // performer page. On a single-date page
    // this is the primary href (rulings 2026-11-02); on a series it keeps the
    // Dec 11 Event from offering the Nov 18 game. Falls back to the primary
    // href only if TicketNetwork cannot be built at all.
    ticketUrlFor: (r) => (tnAllowed ? buildTicketNetworkLink({ team, surface: PROMO_PAGE_SURFACE, eventUrl: eventUrlOf(r), pageSlug: page.slug }) : ticketmaster),
    dateModified: page.updatedAt,
    faqs: storedFaqs,
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
  // A series row still to be played carries its own small "Tickets" link to
  // that date's event (team performer page when unmatched).
  const gameLine = (date: string, row: { displayTime: string; displayOpponent: string; promoId: string; tnEventUrl?: string | null }, key: string, withOpponent: boolean) => {
    // subId1 web_promo_date_{team}: the per-date link, told apart from the
    // primary CTA partner-side (the click event keeps surface web_promo_page).
    const rowTickets = tnAllowed && withOpponent && !removed && date >= today ? buildTicketNetworkLink({ team, surface: PROMO_DATE_SUBID_SURFACE, eventUrl: row.tnEventUrl ?? null, pageSlug: page.slug }) : null;
    return (
      <li key={key} className="m-0 list-none text-[15px] leading-[1.45] text-rd-ink-soft">
        <strong className="text-rd-ink">{`${formatLongDate(date)}${row.displayTime ? ` · ${row.displayTime}` : ''}`}</strong>
        {rowTickets ? (
          <>
            {' '}
            <TrackedAffiliateLink
              href={rowTickets}
              partner="ticketnetwork"
              teamId={team.id}
              sport={team.league}
              promoId={row.promoId}
              surface={PROMO_PAGE_SURFACE}
              placement="promo_page_date"
              ticketLinkLevel={ticketNetworkLinkLevel(row.tnEventUrl)}
              target="_blank"
              rel="noopener noreferrer sponsored"
              ariaLabel={`Tickets for ${formatLongDate(date)}${row.displayOpponent ? ` vs ${row.displayOpponent}` : ''} on TicketNetwork`}
              className="ml-1 font-rd text-[13px] font-semibold text-rd-red no-underline hover:underline"
            >
              Tickets
            </TrackedAffiliateLink>
          </>
        ) : null}
        {withOpponent && row.displayOpponent ? <span className="block">{`vs ${row.displayOpponent}`}</span> : null}
      </li>
    );
  };
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

  // THE RAIL (spec Visuals 3): the team's next promos as cards, through the
  // one shaper the email digest uses. Below two cards the shaper returns
  // nothing and the section keeps a single card.
  const railItems = promoRailItems(ctx.nextTeamPromos.map((p) => ({ href: p.href, title: p.title, date: p.date, type: p.type, themeKey: p.themeKey, ticketPackage: p.ticketPackage })));

  // THIS GAME (spec item 7). Every row is a stored field, a stored game or a
  // count over stored rows, and a row without data is not a row. The other
  // promos on the date moved in here from their own section ("Also at this
  // game" is now a row); the building's other giveaways in the month link to
  // its page.
  const g = ctx.game;
  const thisGame: { label: string; value: ReactNode }[] = [];
  if (!removed) {
    const opponentName = g?.opponentName ?? cleanText(primary.displayOpponent);
    if (opponentName) {
      thisGame.push({
        label: 'Opponent',
        value: g?.opponentHref ? <Link href={g.opponentHref} className="font-medium text-rd-red no-underline hover:underline">{opponentName}</Link> : opponentName,
      });
    }
    if (YMD_RE.test(primary.date)) thisGame.push({ label: multi ? 'Next date' : 'Game', value: `${formatLongDate(primary.date)}${primary.displayTime ? ` · ${primary.displayTime}` : ''}` });
    if (doors) thisGame.push({ label: 'Doors', value: doors });
    if (g?.homeGameNumber && g.homeGamesTotal) {
      // The season is named only when it is not the current one (a page for
      // next season's opener says so; this season's games do not), and never
      // wraps mid-label.
      const season = g.seasonLabel && g.seasonLabel !== seasonLabelFor(team.league, today) ? g.seasonLabel : null;
      thisGame.push({
        label: 'Home schedule',
        value: (
          <>
            {`Home game ${g.homeGameNumber} of ${g.homeGamesTotal}`}
            {season ? <span className="whitespace-nowrap">{`, ${season}`}</span> : null}
          </>
        ),
      });
    }
    if (ctx.alsoAtGame.length) {
      thisGame.push({
        label: multi ? 'Also at these games' : 'Also at this game',
        value: (
          <ul className="m-0 flex flex-col gap-1 p-0">
            {ctx.alsoAtGame.map((p) => (
              <li key={p.href} className="list-none">
                <Link href={p.href} className="font-medium text-rd-red no-underline hover:underline">{p.title}</Link>
                <span className="font-rd text-[12px] text-rd-ink-faint">{` · ${multi ? formatMonDay(p.date) : (PROMO_TYPE_LABELS[p.type] ?? '')}`}</span>
              </li>
            ))}
          </ul>
        ),
      });
    }
    if (ctx.venueGiveaways && venueHref && venueName) {
      const n = ctx.venueGiveaways.count;
      thisGame.push({
        label: ctx.venueGiveaways.month === today.slice(0, 7) ? 'This month' : `In ${monthName(ctx.venueGiveaways.month)}`,
        value: <Link href={venueHref} className="font-medium text-rd-red no-underline hover:underline">{`${n} more giveaway${n === 1 ? '' : 's'} at ${venueName}`}</Link>,
      });
    }
  }

  // No wrapper of its own since the hotfix of 2026-10-30: the route's layout
  // (src/app/[sport]/[team]/promos/[slug]/layout.tsx) renders the rd-root
  // wrapper, with the pn-promo-page hook, as the article's parent.
  return (
    <>
      {jsonLd.map((s, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />
      ))}
      {ctx.short && !removed ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(shortJsonLd(ctx.short, { name: cleanText(primary.title), description: head.description, url: canonical })) }} />
      ) : null}
      {/* Renders nothing: on a shared-link landing it records the share
          session, then cleans the address bar. Outside the article, so the
          article's children (the ad anchors) are unchanged. */}
      <ShareLandingCapture promoId={primary.promoId} team={team.id} league={team.league} pageSlug={page.slug} />
      {/* overflow-anchor: none (ux-review 2026-11-08, D1): after browser back
          the Raptive script tears its slots down and re-inserts them inside
          this article, and Chromium's scroll anchoring moved the restored
          scroll position by a full screen. Live guard 9 measures it. */}
      <article className="page-content mx-auto w-full max-w-[640px] px-4 pb-10 lg:max-w-3xl" data-ad-region="content" style={{ ...themeStyle(palette), overflowAnchor: 'none' } as CSSProperties}>
        <nav aria-label="Breadcrumb" className="flex flex-wrap gap-1.5 pt-3.5 text-[12px] text-rd-ink-faint">
          {leagueHref ? (
            <Link href={leagueHref} className="no-underline hover:text-rd-ink">{team.league}</Link>
          ) : (
            <span>{team.league}</span>
          )}
          <span aria-hidden="true">/</span>
          <Link href={teamHref} className="no-underline hover:text-rd-ink">{teamDisplayName(team)}</Link>
          <span aria-hidden="true">/</span>
          <Link href={crumbHref} className="no-underline hover:text-rd-ink">Promos</Link>
        </nav>

        <header className="flex flex-col gap-2.5 pt-3">
          {/* The thin team-colour band under the breadcrumb (spec Visuals 1).
              Inside the header, not a child of the article: an extra direct
              child would move the ad anchors (".page-content > *", skip 2). */}
          <div aria-hidden="true" className="h-[3px] w-full rounded-full bg-[var(--pp-accent)]" />
          <div className="flex items-center gap-2">
            <span className={`rounded-md px-2 py-1 font-rd text-[11px] font-semibold uppercase tracking-[0.12em] ${removed ? 'bg-rd-ink-soft text-white' : 'bg-[var(--pp-accent)] text-[var(--pp-accent-ink)]'}`}>{badge}</span>
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
          {past ? (
            <p className="m-0 text-[15px] leading-[1.45] text-rd-ink-soft">
              <strong className="text-rd-ink">{multi ? 'These games have been played' : 'This game has been played'}</strong>
            </p>
          ) : null}
          {venueLine ? (
            <p className="m-0 text-[15px] leading-[1.45] text-rd-ink-soft">
              {venueHref ? <Link href={venueHref} className="text-rd-red no-underline hover:underline">{venueName}</Link> : venueName}
              {ctx.hub?.city ? <span>{`, ${ctx.hub.city}`}</span> : null}
              {/* A renamed building names its former name in the Before you
                  go block, or in the quick facts card it falls back to; when
                  neither has anything to show, here instead. */}
              {ctx.formerNames.length && !ctx.beforeYouGo.length && !ctx.quickFacts.length ? <span>{` · formerly ${ctx.formerNames.join(', ')}`}</span> : null}
            </p>
          ) : null}
          {!showAbout ? (
            <div className="flex flex-col gap-0.5">
              {sponsorLine ? <p className="m-0 font-rd text-[12px] text-rd-ink-faint">{sponsorLine}</p> : null}
              {sourceLine}
            </div>
          ) : null}
        </header>

        {!removed && past ? (
          // The played row (ruling 2026-11-08): the tile, then the way
          // forward in place of the tickets. "Next {team} promo" is the
          // team's next upcoming promo page, else the team page; the other
          // editions of this promotion follow when they exist. Share stays.
          // Parking, hotels, the reminder and every affiliate ticket link
          // do not render.
          <section className="mt-4 flex items-stretch gap-3">
            {!multi && YMD_RE.test(primary.date) ? <DateTile ymd={primary.date} state={tileState(primary.date)} size="full" /> : null}
            <div className="flex min-w-0 flex-1 flex-col gap-2.5">
              <div className="flex gap-2">
                <Link href={nextPromoHref} className="flex h-[52px] min-w-0 flex-1 items-center justify-center rounded-[14px] bg-[var(--pp-accent)] font-rd text-[16px] font-semibold text-[var(--pp-accent-ink)] no-underline hover:brightness-95">
                  {`Next ${teamName} promo`}
                </Link>
                <PromoShareRowButton {...shareProps} />
              </div>
              {ctx.previousEdition || ctx.nextEdition ? (
                <div className="flex flex-col gap-1 font-rd text-[14px]">
                  {ctx.previousEdition ? (
                    <Link href={ctx.previousEdition.href} className="font-medium text-rd-red no-underline hover:underline">{`Previous edition: ${cleanText(primary.title)} ${ctx.previousEdition.season} · ${formatLongDate(ctx.previousEdition.date)}`}</Link>
                  ) : null}
                  {ctx.nextEdition ? (
                    <Link href={ctx.nextEdition.href} className="font-medium text-rd-red no-underline hover:underline">{`Next edition: ${cleanText(primary.title)} ${ctx.nextEdition.season} · ${formatLongDate(ctx.nextEdition.date)}`}</Link>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>
        ) : !removed ? (
          <section className="mt-4 flex items-stretch gap-3">
            {/* The date tile (spec Visuals 2) beside the CTA column, so the
                CTA stays above the first in-content unit. A series stacks its
                next dates as shrunk tiles; only the next one carries the
                state line. */}
            {multi ? (
              nextRows.length ? (
                <div className="flex shrink-0 flex-col gap-1.5">
                  {nextRows.map((r, i) => (
                    <DateTile key={r.promoId} ymd={r.date} state={i === 0 ? tileState(r.date) : null} size="mini" />
                  ))}
                </div>
              ) : null
            ) : YMD_RE.test(primary.date) ? (
              <DateTile ymd={primary.date} state={tileState(primary.date)} size="full" />
            ) : null}
            <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            {/* Get tickets and Share on ONE row (2026-11-03): tickets fills the
                width, Share is the compact outline at the right, same 52px.
                The row's height is the button's, so the section is as tall as
                before. nowrap by construction: Share never drops below. */}
            <div className="flex gap-2">
              <TrackedAffiliateLink
                href={tickets}
                partner={ticketsPartner}
                teamId={team.id}
                sport={team.league}
                promoId={primary.promoId}
                surface={PROMO_PAGE_SURFACE}
                placement="promo_page_primary"
                ticketLinkLevel={ticketsLevel}
                target="_blank"
                rel="noopener noreferrer sponsored"
                ariaLabel={ticketsLevel === 'event' || !multi ? `Get tickets for ${teamName}${primary.displayOpponent ? ` vs ${primary.displayOpponent}` : ''} on ${ticketsBrand}` : `Get ${teamName} tickets on ${ticketsBrand}`}
                className="flex h-[52px] min-w-0 flex-1 items-center justify-center rounded-[14px] bg-[var(--pp-accent)] font-rd text-[16px] font-semibold text-[var(--pp-accent-ink)] no-underline hover:brightness-95"
              >
                Get tickets
              </TrackedAffiliateLink>
              <PromoShareRowButton {...shareProps} />
            </div>
            {ticketNetwork ? (
              <TrackedAffiliateLink
                href={ticketmaster}
                partner="ticketmaster"
                teamId={team.id}
                sport={team.league}
                promoId={primary.promoId}
                surface={PROMO_PAGE_SURFACE}
                placement="promo_page_ticketmaster"
                ticketLinkLevel="team"
                target="_blank"
                rel="noopener noreferrer sponsored"
                ariaLabel={`${teamName} tickets, also on Ticketmaster`}
                className="self-center font-rd text-[14px] font-medium text-rd-red no-underline hover:underline"
              >
                Also on Ticketmaster
              </TrackedAffiliateLink>
            ) : null}
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
                href={promoDownloadHref(team.id, primary.promoId, page.slug)}
                platform="unknown"
                section="promo_page_cta"
                page="promo_page"
                surface="promo_cta"
                teamSlug={team.id}
                promoId={primary.promoId}
                pageSlug={page.slug}
                plainAnchor
                className="flex h-11 min-w-[104px] flex-1 basis-0 items-center justify-center whitespace-nowrap rounded-xl border border-rd-line-strong bg-rd-card px-2 font-rd text-[14px] font-medium text-rd-ink no-underline hover:border-rd-ink"
              >
                Remind me
              </TrackedAppLink>
            </div>
            </div>
          </section>
        ) : null}

        {/* Tier 1 photos only (docs/per-promo-pages-v2-spec.md, 2026-11-07).
            The generated card (tier 3, and rows with no tier) left the body:
            it restated the H1 in a picture. It stays the Event schema image
            (imageUrl, above) and the og:image stays the share card, both
            unchanged. Without a photo there is no figure and no image share
            icon; the row Share beside Get tickets remains.

            relative, and the clipping moved from the figure to the image
            (2026-11-03): the share icon sits on the image's corner and its
            desktop popover must not be clipped by the figure. */}
        {image.kind === 'photo' ? (
          <figure className="relative m-0 mt-4 rounded-2xl border border-rd-line bg-rd-card">
            {/* object-contain on a cream ground (hotfix 2026-10-30), so a
                photo of any shape shows whole. It is the page's largest paint
                (follow-up 2026-10-31): never lazy, fetched at high priority,
                and its width and height are the stored photo's own, read by
                the route, so the browser knows its shape up front. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- the tier 1 photo is a stored object whose dimensions are not on the row; next/image would add a second request and a remote-pattern entry for nothing. */}
            <img
              src={image.url}
              alt={image.alt}
              width={image.width ?? undefined}
              height={image.height ?? undefined}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              className="block h-[220px] w-full rounded-t-[15px] bg-[#ebe4d6] object-contain"
            />
            {!removed ? <PromoShareImageButton {...shareProps} /> : null}
            <figcaption className="px-3 py-2 font-rd text-[11px] text-rd-ink-faint">
              <span>{`${image.credit ?? `Image: ${teamName}`}${image.sourceUrl ? ' · ' : ''}`}</span>
              {image.sourceUrl ? <a href={image.sourceUrl} target="_blank" rel="noopener nofollow" className="text-rd-red">source</a> : null}
            </figcaption>
          </figure>
        ) : null}

        {/* The promo's Short (the social bridge, 2026-11-05): click to load,
            fixed size, its own direct child of the article under the image,
            so the CTA row and the image above it keep their places. */}
        {ctx.short && !removed ? <PromoShort videoId={ctx.short.videoId} title={ctx.short.title} /> : null}

        {showAbout ? (
        <section className="mt-6 flex flex-col gap-2">
          {/* A package row is not a theme night or a giveaway (the team page's
              package group says so): its heading names the package. */}
          <H2>{`About this ${removed ? 'promotion' : primary.ticketPackageRequired === true ? 'ticket package' : typeNoun(primary.type, team.league)}`}</H2>
          {description ? <p className="m-0 text-[15px] leading-[1.55] text-rd-ink-soft">{description}</p> : null}
          {/* Every package row says so in the ruling's own words (2026-10-24),
              the sentence the team page's package rows carry. The stored
              package name, when there is one, goes on its own line with
              nothing appended: names often end in "Ticket Package" already,
              and the old "Comes with the {name} ticket package." doubled it.
              ticketPackageRequired is null outside NBA and NHL. */}
          {primary.ticketPackageRequired === true ? (
            <p className="m-0 text-[15px] leading-[1.55] text-rd-ink-soft">{TICKET_PACKAGE_ROW_NOTE}</p>
          ) : null}
          {primary.ticketPackageRequired === true && cleanText(primary.ticketPackageName) ? (
            <p className="m-0 text-[15px] leading-[1.55] text-rd-ink-soft">{`Package: ${cleanText(primary.ticketPackageName)}`}</p>
          ) : null}
          {sponsorLine ? <p className="m-0 text-[15px] leading-[1.55] text-rd-ink-soft">{sponsorLine}</p> : null}
          {sourceLine}
        </section>
        ) : null}

        {thisGame.length ? (
          <section className="mt-6 flex flex-col gap-2.5 rounded-2xl border border-rd-line bg-rd-card p-3.5">
            <H2>{multi ? 'Next game' : 'This game'}</H2>
            <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-[15px] leading-[1.45]">
              {thisGame.map((r) => (
                <Fragment key={r.label}>
                  <dt className="pt-0.5 font-rd text-[10px] uppercase tracking-[0.12em] text-rd-ink-faint">{r.label}</dt>
                  <dd className="m-0 min-w-0 text-rd-ink">{r.value}</dd>
                </Fragment>
              ))}
            </dl>
            {/* The season timeline (spec Visuals 4), derived from the spine:
                null below three home games, so nothing renders. */}
            {ctx.timeline ? <SeasonTimeline games={ctx.timeline.games} promos={ctx.timeline.promos} thisDate={primary.date} thisHref={promoPagePath(team.sportSlug, team.id, page.slug)} teamName={teamName} /> : null}
          </section>
        ) : null}

        {explainer ? (
          <section className="mt-6 flex flex-col gap-2.5 rounded-2xl border border-rd-line bg-rd-card p-3.5">
            {/* The authored library (spec item 6): its own card, the
                small-caps label first, so it reads as a general guide and
                never as a claim about this game. */}
            <p className="m-0 font-rd text-[10px] font-semibold uppercase tracking-[0.14em] text-rd-ink-faint">{EXPLAINER_LABEL}</p>
            <H2>{explainer.title}</H2>
            {explainer.paragraphs.map((text) => (
              <p key={text.slice(0, 48)} className="m-0 text-[15px] leading-[1.55] text-rd-ink-soft">{text}</p>
            ))}
          </section>
        ) : null}

        {ctx.beforeYouGo.length && venueName ? (
          // Spec item 8 (step 4, 2026-11-08): the building's facts from the
          // provenance record. Each row is a field in state `rendered`, with
          // the date its source was read and the operator page when the record
          // names one (src/lib/before-you-go.ts). Nothing rendered, no block.
          <section id="before-you-go" className="mt-6 flex flex-col gap-2.5 rounded-2xl border border-rd-line bg-rd-card p-3.5">
            <H2>{BEFORE_YOU_GO_LABEL}</H2>
            <p className="m-0 font-rd text-[12px] text-rd-ink-faint">
              {venueName}
              {ctx.formerNames.length ? <span>{`, formerly ${ctx.formerNames.join(', ')}`}</span> : null}
            </p>
            <dl className="m-0 flex flex-col gap-2.5 text-[14px] text-rd-ink">
              {ctx.beforeYouGo.map((r) => (
                <div key={r.key}>
                  <dt className="font-rd text-[10px] uppercase tracking-[0.12em] text-rd-ink-faint">{r.label}</dt>
                  <dd className="m-0">
                    {r.text}
                    {/* The provenance line, the venue page's words: the operator
                        host as the link, then the read date. A union row (a
                        class the quick facts card would have shown, undated)
                        keeps the link and has no "Source read". */}
                    {r.sourceUrl || r.observedOn ? (
                      <span className="block font-rd text-[11px] text-rd-ink-faint">
                        {r.sourceUrl && r.sourceHost ? (
                          <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-rd-red">{`${r.sourceHost} ›`}</a>
                        ) : null}
                        {r.observedOn ? `${r.sourceUrl ? ' · ' : ''}Source read ${r.observedOn}` : null}
                      </span>
                    ) : null}
                  </dd>
                </div>
              ))}
            </dl>
            {venueHref ? (
              <Link href={venueHref} className="font-rd text-[14px] font-medium text-rd-red no-underline hover:underline">{`${venueName} gameday guide`}</Link>
            ) : null}
          </section>
        ) : ctx.quickFacts.length && venueName ? (
          // THE FALLBACK (ruling 2026-11-08): when Before you go has zero rows,
          // the venue quick facts card renders exactly as it did before step 4
          // (any sourced field through the published view, no state or date
          // required). One or more rows and Before you go replaces it; never
          // both. REMOVE THIS BRANCH, the `quickFacts` context field and its
          // loader when provenance coverage (pages whose building has at least
          // one verified, rendered, dated field) reaches 90% of upcoming promo
          // pages; on 2026-11-08 it is 475 of 1,152 (scripts/audit-before-you-go.ts).
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
          <H2>{`More ${teamDisplayName(team)} ${ctx.nextTeamPromos.length && ctx.nextTeamPromos.every((p) => p.type === 'giveaway') ? 'giveaways' : 'promos'}`}</H2>
          {/* The sprite once per page, inside this section (never a direct
              child of the article: that would be an ad anchor). */}
          <PromoTypeSprite />
          {railItems.length ? (
            <PromoRail items={railItems} label={`More ${teamDisplayName(team)} promos`} />
          ) : (
            ctx.nextTeamPromos.slice(0, 1).map((p) => <PromoCard key={p.href} p={p} showTeam={false} />)
          )}
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
    </>
  );
}
