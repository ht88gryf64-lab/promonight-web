// WHAT A TICKET BUTTON SAYS (ruling 2026-11-25, audit item 7).
// Pure and client-safe: strings only.
//
// Every ticket button reads "Get Tickets", TicketNetwork and Ticketmaster
// alike, on every surface. What differs is said UNDER the button: TicketNetwork
// is a resale marketplace, so each TicketNetwork button or button group carries
// one line saying so. One line per group, never one per button (an event stop
// with eight showtimes prints it once). Ticketmaster buttons carry no line.
//
// ONE RULE FOR EVERY SURFACE, present and future. The Banana Ball event pages
// inherit it (docs/events-banana-ball-brief.md), and so does any new resale
// partner: its line is added here, never typed into a component.
//
// Analytics is untouched: event names, surfaces and placements do not change
// (docs/cta-registry.md).

/** The visible text of every ticket button. */
export const TICKET_CTA_LABEL = 'Get Tickets';

/** The one line under a TicketNetwork button or button group. */
export const TICKETNETWORK_RESALE_NOTE = 'TicketNetwork is a resale marketplace. Prices may differ from face value.';

/** The one line under a test team's ticket button or button group while the
 *  ticket partner test runs (src/lib/ticket-test.ts, Gate 0 ruling 4,
 *  2026-11-25): the same sentence on both arms, in place of the resale line
 *  above, naming no partner. */
export const TICKET_TEST_NOTE = 'PromoNight may earn a commission on ticket purchases. Resale prices may differ from face value.';

/** aria-label of a ticket link that needs context beyond its visible text. It
 *  BEGINS with the visible text, so the accessible name contains what a
 *  sighted fan reads (WCAG 2.5.3). */
export function ticketAriaLabel(context: string, partner: 'TicketNetwork' | 'Ticketmaster' | 'StubHub'): string {
  return `${TICKET_CTA_LABEL} ${context} on ${partner}`;
}
