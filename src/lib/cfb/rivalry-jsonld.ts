// JSON-LD builders for the rivalry family (/cfb/rivalries + detail pages).
// Pure functions returning schema objects; the routes render one <script> per
// entity (house pattern, see AggregatorJsonLd in aggregator-layout.tsx:347).
//
// Verify-gate discipline (build order + types.ts LOCKED DECISION 5): a kickoff
// time or broadcast network reaches the SportsEvent ONLY when the game is
// verified:true. An unverified game emits a bare date and no broadcast — never
// a placeholder, never a guessed time.

import type { MatchupPage } from '@/lib/cfb/matchups';
import type { CfbGame } from '@/lib/cfb/types';
import { buildMatchupDescription, prettySchoolId } from '@/lib/cfb/matchup-description';
import { renderedKickoff, RIVALRY_INDEX_TITLE, RIVALRY_INDEX_DESCRIPTION } from '@/lib/cfb/metadata';
import type { RivalryFaq, RivalryIndexRow } from '@/lib/cfb/rivalry-index';
// The pipeline's single time parser + tz tools (guards.ts). One parser
// everywhere — the display layer and JSON-LD cannot drift (see data.ts:12-16).
import { normTime, IANA, ianaOffsetMinutes } from '../../../scripts/cfb/lib/guards';

const BASE = 'https://www.getpromonight.com';
const YEAR = 2026; // hardcoded by house rule, never getFullYear() in SEO copy
// Site default OG image as the SportsEvent image — same trade-off as
// scored-jsonld.tsx:23-27 (satisfies the recommended field without a new
// image-resolution path).
const EVENT_IMAGE = `${BASE}/og-image.png`;

type Schema = Record<string, unknown>;

// ── /cfb/rivalries (index): CollectionPage + ItemList + FAQPage ──────────────

/** rows MUST be the same orderedIndexRows() array the DOM list renders, so
 *  numberOfItems and the item order can never diverge from the served list. */
export function buildRivalryIndexJsonLd(rows: RivalryIndexRow[], faqs: RivalryFaq[]): Schema[] {
  const url = `${BASE}/cfb/rivalries`;
  const schemas: Schema[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: RIVALRY_INDEX_TITLE,
      description: RIVALRY_INDEX_DESCRIPTION,
      url,
      isPartOf: {
        '@type': 'WebSite',
        name: 'PromoNight',
        url: BASE,
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: RIVALRY_INDEX_TITLE,
      numberOfItems: rows.length,
      itemListElement: rows.map((r, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: `${r.name} ${YEAR}`,
        url: `${BASE}/cfb/rivalries/${r.slug}`,
      })),
    },
  ];
  if (faqs.length > 0) {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    });
  }
  return schemas;
}

// ── detail pages: BreadcrumbList + SportsEvent ───────────────────────────────

/** ISO-8601 startDate for the SportsEvent. Time and offset ONLY when the game
 *  is verified AND the kickoff is announced and parseable; every other case is
 *  the bare date. An unknown tz also degrades to the bare date — never guess. */
export function sportsEventStartDate(game: Pick<CfbGame, 'date' | 'kickoff' | 'verified'>): string {
  if (game.verified !== true) return game.date;
  const k = game.kickoff;
  if (!k || k.tbd) return game.date;
  const hhmm = normTime(k.time ?? '');
  if (hhmm === 'TBD') return game.date;
  // Stored tz is an abbreviation in practice ("CT", "ET" — see the Phase 0
  // schema-drift note), an IANA zone by contract. Accept both; resolve through
  // the SAME map the pipeline's timezone guard uses.
  const iana = k.tz?.includes('/') ? k.tz : IANA[(k.tz || '').toUpperCase().replace(/[^A-Z_/]/g, '')];
  if (!iana) return game.date;
  try {
    const off = ianaOffsetMinutes(iana, game.date);
    const sign = off < 0 ? '-' : '+';
    const abs = Math.abs(off);
    const hh = String(Math.floor(abs / 60)).padStart(2, '0');
    const mm = String(abs % 60).padStart(2, '0');
    return `${game.date}T${hhmm}:00${sign}${hh}:${mm}`;
  } catch {
    // An invalid IANA string makes Intl throw inside ianaOffsetMinutes; a bad
    // stored tz must degrade to the bare date, never crash the SSG render.
    return game.date;
  }
}

export function buildRivalryMatchupJsonLd(data: MatchupPage): Schema[] {
  const url = `${BASE}/cfb/rivalries/${data.slug}`;
  const [a, b] = data.schools;
  const [aId, bId] = data.rivalry.schoolIds;

  const schemas: Schema[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'College Football', item: `${BASE}/cfb` },
        { '@type': 'ListItem', position: 2, name: 'Rivalries', item: `${BASE}/cfb/rivalries` },
        // Final crumb is the page itself; no item URL by Google's own pattern.
        { '@type': 'ListItem', position: 3, name: `${data.displayName} ${YEAR}` },
      ],
    },
  ];

  const game = data.game;
  if (game) {
    // Resolve a display name for either side of the game, tracked or not.
    const nameFor = (id: string): string =>
      (a && a.id === id ? a.name : b && b.id === id ? b.name : prettySchoolId(id));

    const event: Schema = {
      '@context': 'https://schema.org',
      '@type': 'SportsEvent',
      name: `${data.displayName} ${YEAR}`,
      // Same builder and inputs as the meta description and the visible lede,
      // so the schema description can never claim what the page does not show.
      description: buildMatchupDescription({
        displayName: data.displayName,
        schoolA: a?.name ?? prettySchoolId(aId),
        schoolB: b?.name ?? prettySchoolId(bId),
        date: game.date,
        // The verify gate applies to the WHOLE SportsEvent, prose included: an
        // unverified game's stored time must not ride into the entity through
        // the description while startDate correctly withholds it. (The visible
        // lede/meta description keep their own pre-existing behavior; today
        // every verified:false game is also kickoff.tbd, so all surfaces agree.)
        kickoff: game.verified === true ? renderedKickoff(game) : null,
        venueName: data.resolvedVenue?.name ?? null,
        venueCity: data.resolvedVenue?.city ?? null,
      }),
      url,
      startDate: sportsEventStartDate(game),
      eventStatus: game.status === 'canceled' ? 'https://schema.org/EventCancelled' : 'https://schema.org/EventScheduled',
      image: EVENT_IMAGE,
      homeTeam: { '@type': 'SportsTeam', name: nameFor(game.homeSchoolId) },
      awayTeam: { '@type': 'SportsTeam', name: nameFor(game.awaySchoolId) },
    };

    if (data.resolvedVenue) {
      const v = data.resolvedVenue;
      event.location = {
        '@type': 'Place',
        name: v.name,
        ...(v.city || v.state
          ? {
              address: {
                '@type': 'PostalAddress',
                ...(v.city ? { addressLocality: v.city } : {}),
                ...(v.state ? { addressRegion: v.state } : {}),
                addressCountry: 'US',
              },
            }
          : {}),
      };
    }

    // Broadcast rides on the verify gate AND the confirmed flag; a "TBD"
    // network never ships. BroadcastEvent via subjectOf is the schema.org
    // shape (BroadcastEvent.broadcastOfEvent's inverse relation).
    if (game.verified === true && game.broadcast?.confirmed === true && game.broadcast.network && !/tbd/i.test(game.broadcast.network)) {
      event.subjectOf = {
        '@type': 'BroadcastEvent',
        isLiveBroadcast: true,
        publishedOn: { '@type': 'BroadcastService', name: game.broadcast.network },
      };
    }

    schemas.push(event);
  }

  return schemas;
}
