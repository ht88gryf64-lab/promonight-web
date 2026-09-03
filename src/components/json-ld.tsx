import type { Team, Promo, PromoType, Venue, PlayoffPromo } from '@/lib/types';
import { generateTeamFAQs, teamDisplayName, type PlayoffFAQContext, type TeamFaqCoverage } from '@/lib/promo-helpers';
import { teamBareTitle } from '@/lib/title-treatment';

interface JsonLdProps {
  team: Team;
  /** UPCOMING promos and their counts, split once by the page. Everything this
   *  component emits is a machine-readable claim, so nothing past-dated may
   *  reach it: Event entities would advertise finished events, and the FAQPage
   *  answers would restate a closed season in the present tense. */
  upcomingPromos: Promo[];
  venue: Venue | null;
  upcomingCounts: Record<PromoType, number>;
  /** Sitewide coverage facts, derived by the page from getCoverageCounts().
   *  Reaches the FAQPage answers, so nothing in it may be a hardcoded literal. */
  coverage: TeamFaqCoverage;
  playoffPromos?: PlayoffPromo[];
  playoffContext?: PlayoffFAQContext;
}

function buildPlace(venue: Venue | null) {
  if (!venue) return undefined;
  return {
    '@type': 'Place',
    name: venue.name,
    address: {
      '@type': 'PostalAddress',
      streetAddress: venue.address,
    },
  };
}

export function JsonLd({
  team,
  upcomingPromos,
  venue,
  upcomingCounts,
  coverage,
  playoffPromos,
  playoffContext,
}: JsonLdProps) {
  // No date filtering here any more. The page splits once with
  // splitPromosByDate and hands this component the upcoming half, so there is
  // exactly one definition of "upcoming" in the codebase.
  const teamUrl = `https://www.getpromonight.com/${team.sportSlug}/${team.id}`;

  const events = upcomingPromos.map((promo) => ({
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: promo.title,
    startDate: promo.date,
    description: promo.description || `${promo.title} at ${venue?.name || 'the stadium'}`,
    location: buildPlace(venue),
    organizer: {
      '@type': 'SportsTeam',
      name: teamDisplayName(team),
    },
  }));

  // Playoff Events — only for dated promos. Recurring (date=null) get no Event schema.
  // startDate is emitted date-only (YYYY-MM-DD). Upstream Firestore values store a
  // noon placeholder (scanner uses `new Date(dateStr + "T12:00:00")` with no TZ, so
  // the hour portion is an artifact of whatever machine wrote the doc — UTC on CI,
  // CDT on dev boxes). Date-only is honest and still valid ISO-8601.
  const playoffEvents = (playoffPromos ?? [])
    .filter((p) => !!p.date)
    .map((promo) => ({
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: promo.title,
      startDate: (promo.date as string).slice(0, 10),
      description:
        promo.description ||
        `${promo.title}${venue ? ` at ${venue.name}` : ''}`,
      location: buildPlace(venue),
      organizer: {
        '@type': 'SportsTeam',
        name: teamDisplayName(team),
      },
      offers: {
        '@type': 'Offer',
        url: teamUrl,
      },
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    }));

  // Brand-named questions are dropped from the STRUCTURED DATA only. The
  // visible FAQ (team-faq.tsx) calls the same generator unfiltered and is
  // unchanged, so the schema stays a strict subset of what the page shows,
  // which is the safe direction: the policy failure is schema asserting
  // content the page does not display.
  //
  // Without this, Google receives "Does PromoNight work for away games?" as a
  // declared FAQ on a Los Angeles Rams page. Every one of the 169 teams carries
  // exactly one such question, so this changes the FAQPage payload on all of
  // them by design, populated pages included. That is the deliberate scope:
  // gating it on zero-promo pages would de-brand structured data only where
  // there is no content, which is incoherent.
  //
  // The payload cannot empty. Five slots are unconditional and a sixth (gate
  // times) covers all six leagues, so the floor across all 169 teams is 6
  // before this filter and 5 after, and the faqs.length > 0 guard below never
  // fires. That argument holds for a blacklist only; an allowlist could reach 0
  // and would silently drop the whole entity.
  const faqs = generateTeamFAQs(team, upcomingPromos, venue, upcomingCounts, coverage, playoffContext).filter(
    (faq) => !faq.brandPromo,
  );
  const faqSchema = faqs.length > 0
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
      }
    : null;

  // Page-level WebPage entity. dateModified is deliberately OMITTED: it used to
  // be new Date() per ISR render, a synthetic always-now freshness claim across
  // all 169 team pages (docs/known-issues.md entry 17). The base Promo carries
  // no stored updatedAt, so there is no truthful per-team stamp to bind; omit
  // rather than synthesize. datePublished stays: a static launch anchor is a
  // real, fixed claim.
  const webPage = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': teamUrl,
    url: teamUrl,
    // Was an independent hardcoded copy of the page title, season year inline.
    // It now reads the same helper the <title> and og:title do, so the WebPage
    // entity can never disagree with the title a crawler sees, and the
    // ctr-diagnostic-sep2026 treatment reaches this surface too.
    name: teamBareTitle(team, teamDisplayName(team)),
    datePublished: '2025-12-01',
  };

  const schemas = [
    webPage,
    ...events,
    ...playoffEvents,
    ...(faqSchema ? [faqSchema] : []),
  ];

  // webPage is always present, so this is unreachable today; kept as a
  // defensive guard in case the schema set is ever made conditional again.
  if (schemas.length === 0) return null;

  // Emit one <script> per entity (Google Rich Results Test's code-paste parser
  // doesn't accept bare JSON arrays; one-tag-per-entity also matches Google's
  // documented preferred format).
  return (
    <>
      {schemas.map((s, i) => (
        <script
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }}
        />
      ))}
    </>
  );
}
