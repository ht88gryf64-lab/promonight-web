// Normalized payload the share suite renders + shares. Promo cards and game
// cards both project their domain data down to this shape so ShareSheet and
// the channel builders stay surface-agnostic.
export interface ShareItem {
  /** Emoji shown in the preview card + prefixed onto share text. */
  icon: string;
  /** Headline line — a promo title ("Bobblehead Night") or a matchup ("vs Yankees"). */
  promoTitle: string;
  /** Team display name, e.g. "New York Mets". */
  teamName: string;
  /** Human-readable date, pre-formatted via formatShareDate. */
  date: string;
  /** Venue name. Optional — omitted from share text when absent. */
  venue?: string | null;
  /** Sport slug (lowercase path segment, e.g. "mlb") — used for the share URL + analytics. */
  sport: string;
  /** Team slug / id (e.g. "new-york-mets") — used for the share URL + analytics. */
  teamSlug: string;
  /** Promo type ("giveaway" | "theme" | …) or "game" — analytics only. */
  promoType?: string;
  /** Team primary color (hex) used to tint the preview card. Falls back to neutral dark. */
  primaryColor?: string | null;
}
