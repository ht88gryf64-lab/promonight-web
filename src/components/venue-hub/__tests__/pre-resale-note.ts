// The venue-page byte goldens (venue-bag-holds, venue-bag-render) pin every
// building's markup length against a stored baseline, to prove a change left
// the pages it did not mean to touch alone. The 2026-11-25 ticket rule
// (src/lib/ticket-labels.ts) deliberately touches every page with a ticket
// card: a resale line under the TicketNetwork button, one more sentence in the
// affiliate disclosure, accessible names that match the visible text, and a
// space between the brand and "Get Tickets". This undoes exactly those four
// things, so the goldens keep proving what they were written to prove without
// 223 baselines being regenerated for a change that has its own tests
// (src/components/affiliates/__tests__/ticket-labels.test.tsx).
export function withoutResaleNote(html: string): string {
  return html
    .replace(/<p data-resale-note=""[^>]*>[^<]*<\/p>/g, '')
    .replaceAll(' Tickets on TicketNetwork are resold by other sellers, so a price there can be above or below face value.', '')
    .replaceAll('aria-label="Ticketmaster Get Tickets"', 'aria-label="Get tickets on Ticketmaster"')
    .replaceAll('aria-label="TicketNetwork Get Tickets"', 'aria-label="Get tickets on TicketNetwork"')
    .replace(/ (<span class="[^"]*">Get Tickets<\/span>)/g, '$1');
}
