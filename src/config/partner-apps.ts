// Fan-made companion apps, keyed by PromoNight team slug.
//
// These are third-party apps built by independent developers and surfaced on a
// team page as editorial context. They are NOT promos. Nothing in this file is
// written to Firestore, nothing joins the `promos` collection, and nothing
// feeds team-page JSON-LD (no SoftwareApplication / MobileApplication entity —
// that type was removed sitewide after a Google rich-results error; see
// components/redesign/AppDownloadBlock.tsx).
//
// WHY THESE APPS ARE NOT PROMOS. The offers they track are CONDITIONAL, not
// scheduled: a free sandwich if an opposing player misses two consecutive
// fourth-quarter free throws, fries if the home team hits eleven threes. They
// have no date, so they cannot be a promo row, cannot be scored, and cannot be
// an Event. Excluding them from the calendar is the design, not a coverage gap
// — which is exactly what the section copy tells the reader.
//
// KEY = Team.id, the /[sport]/[team] URL segment (e.g. 'minnesota-timberwolves').
// There is NO `slug` field on Team; `id` is the slug. A key that matches no
// real Team.id fails silently: no tsc error, no test failure, the module just
// never renders. Copy the id out of an existing slug-keyed table
// (src/lib/fanatics-ad-ids.ts) rather than typing it from memory.
//
// An entry is a published claim about a real third party. Add one only with
// the store listing open: `name` and `developer` are printed verbatim on the
// card and must match the listing.
//
// This module is deliberately import-free (no firebase, no server-only) so it
// can be read from a server component, a client leaf, or a test.

/** Store the app ships on. Widen when the first non-iOS entry lands. */
export type PartnerAppPlatform = 'ios';

// Stable analytics identity for the app, carried as `partner` on
// partner_app_click. Deliberately NOT derived from `name`: `name` is display
// copy that can be re-cased or re-worded, and a PostHog dimension that moves
// with a copy edit silently splits its own series. A closed union makes a typo
// a tsc error, matching how every other partner dimension in lib/analytics is
// typed (AffiliatePartner, ResaleClickProperties.partner).
export type PartnerAppId = 'wolves_chicken';

export interface PartnerAppEntry {
  // ── The app ────────────────────────────────────────────────────────────
  /** Title exactly as the store lists it. */
  name: string;
  /** Developer exactly as the store credits them. */
  developer: string;
  url: string;
  platform: PartnerAppPlatform;
  /** One sentence, the card body. */
  blurb: string;
  /** Analytics identity. See PartnerAppId. */
  partner: PartnerAppId;

  // ── The section around it ──────────────────────────────────────────────
  // Section copy lives per entry rather than in the component because every
  // word of it is team-specific: the heading names the building, the intro
  // names the promos and the brands running them, and the disclosure names
  // the parties the app is not affiliated with. Hardcoding any of it in
  // FanTools would produce a module that renders a lie for the second entry.
  /** Section heading. */
  heading: string;
  /** Explainer paragraphs, one string per <p>, in order. */
  intro: readonly string[];
  /** Standing disclosure printed under the card. */
  disclosure: string;
}

export const PARTNER_APPS: Record<string, PartnerAppEntry> = {
  'minnesota-timberwolves': {
    name: 'Wolves Chicken',
    developer: 'David Cocchiarella',
    url: 'https://apps.apple.com/us/app/wolves-chicken/id6761731987',
    platform: 'ios',
    blurb: 'Tracks both live and alerts you the moment the chicken is secured.',
    partner: 'wolves_chicken',
    heading: 'Free food promos at Target Center',
    intro: [
      'The Timberwolves run two conditional food promos at home games. If an opposing player misses two consecutive free throws in the fourth quarter or overtime, every fan gets a free Chick-fil-A Original Chicken Sandwich, claimed the next day through the official Timberwolves app. A separate McDonald’s fries deal triggers when the Wolves hit 11 three-pointers.',
      'Both are conditional rather than scheduled, so they will not appear on the promo calendar below. You find out during the game.',
    ],
    disclosure:
      'Independent fan-made app, not affiliated with the Timberwolves, Chick-fil-A, or McDonald’s.',
  },
};

/** The entry for a team, or null when the team has no partner app. */
export function getPartnerApp(teamSlug: string): PartnerAppEntry | null {
  return PARTNER_APPS[teamSlug] ?? null;
}
