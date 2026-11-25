// WHAT A TICKET BUTTON SAYS, BY PARTNER (ruling 2026-11-25, audit item 7).
// Pure and client-safe: strings only.
//
// TicketNetwork is a resale marketplace. Its buttons used to read "Get
// Tickets", the same words as the Ticketmaster button beside them, and a fan
// had no way to tell a primary box office from a resale listing before the
// tap. So every TicketNetwork button reads "Resale tickets" and carries one
// line under it saying what that means. Ticketmaster keeps "Get Tickets".
//
// ONE RULE FOR EVERY SURFACE, present and future: a ticket link to a resale
// marketplace is labelled as resale, with the note under it. The Banana Ball
// event pages inherit this rule (docs/events-banana-ball-brief.md), and so
// does any new partner: add its label here, never in a component.
//
// Analytics is untouched: event names, surfaces and placements do not change
// with the label (docs/cta-registry.md).

/** The visible text of every TicketNetwork button and link. */
export const TICKETNETWORK_CTA_LABEL = 'Resale tickets';

/** The one line under a TicketNetwork button. */
export const TICKETNETWORK_RESALE_NOTE = 'TicketNetwork is a resale marketplace. Prices may differ from face value.';

/** The visible text of the Ticketmaster button. */
export const TICKETMASTER_CTA_LABEL = 'Get Tickets';

/** aria-label of a TicketNetwork link. It BEGINS with the visible text, so the
 *  accessible name contains what a sighted fan reads (WCAG 2.5.3), then adds
 *  the context a screen reader needs. */
export function ticketNetworkAriaLabel(context?: string): string {
  return context ? `${TICKETNETWORK_CTA_LABEL} ${context} on TicketNetwork` : `${TICKETNETWORK_CTA_LABEL} on TicketNetwork`;
}
