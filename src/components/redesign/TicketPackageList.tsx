import type { Promo } from '@/lib/types';
import { promoAnchorId } from '@/lib/promo-helpers';
import { PromoArrivalHighlight } from './PromoArrivalHighlight';
import {
  TICKET_PACKAGE_ROW_NOTE,
  TICKET_PACKAGES_SUBLINE,
  ticketPackagesHeading,
} from '@/lib/ticket-packages';

// The special-ticket rows of an NHL or NBA team page, in their own group
// (WEB6 addendum, 2026-10-05; the rule is in src/lib/ticket-packages.ts).
//
// A SERVER COMPONENT. Its only client child is PromoArrivalHighlight (no
// props), mounted on a page with no promo list. The page mounts this block only
// when there is at least one package ahead: a page without packages renders
// exactly what it rendered before.
//
// AD CONTRACT. No `page-content` wrapper anywhere inside, so the ad placer has
// no anchor in this block: no unit lands between two package rows or inside the
// <details>. The block adds height below the promo list and nothing above it.

/** Rows shown before the rest collapse. The Red Wings carried 51 packages on
 *  2026-10-05; the group should not push everything below it a screen down. */
export const TICKET_PACKAGES_VISIBLE = 4;

function packageDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

// Every row keeps the anchor id it had as a PromoList row, so the /promos/today,
// venue-hub and hub cards that still link to #promo-... land on it (review
// round 3). A row inside the closed <details> is opened by PromoArrivalHighlight,
// which looks for data-ticket-packages on the details element.
function PackageRow({ promo }: { promo: Promo }) {
  return (
    <li id={`promo-${promoAnchorId(promo)}`} className="rounded-2xl border border-rd-line bg-rd-card px-4 py-3 sm:px-5">
      <div className="font-rd text-[11px] uppercase tracking-[0.12em] text-rd-ink-faint">
        {packageDate(promo.date)}
        {promo.opponent ? ` · vs ${promo.opponent}` : ''}
      </div>
      <div className="mt-1 font-rd text-base font-semibold text-rd-ink">{promo.title}</div>
      <p className="mt-1 font-rd text-sm leading-relaxed text-rd-ink-soft">{TICKET_PACKAGE_ROW_NOTE}</p>
      {promo.description ? (
        <p className="mt-1 font-rd text-xs leading-relaxed text-rd-ink-faint">{promo.description}</p>
      ) : null}
    </li>
  );
}

export function TicketPackageList({
  packages,
  arrivalHighlight = false,
}: {
  packages: Promo[];
  /** Mount the deep-link arrival effect here. Only on a page with no promo list
   *  (the list mounts its own); two instances would both scroll. */
  arrivalHighlight?: boolean;
}) {
  if (packages.length === 0) return null;
  const shown = packages.slice(0, TICKET_PACKAGES_VISIBLE);
  const rest = packages.slice(TICKET_PACKAGES_VISIBLE);
  return (
    <section className="px-6 pb-12" aria-labelledby="ticket-packages-heading">
      {arrivalHighlight ? <PromoArrivalHighlight /> : null}
      <div className="mx-auto max-w-5xl">
        <div className="mb-4">
          <span className="font-rd text-[11px] uppercase tracking-[0.14em] text-rd-ink-faint">
            Special tickets
          </span>
          <h3 id="ticket-packages-heading" className="rd-display mt-1 text-2xl text-rd-ink md:text-3xl">
            {ticketPackagesHeading(packages.length)}
          </h3>
          <p className="mt-2 font-rd text-xs text-rd-ink-faint">{TICKET_PACKAGES_SUBLINE}</p>
        </div>
        <ul className="space-y-3">
          {shown.map((p, i) => (
            <PackageRow key={`tp-${i}`} promo={p} />
          ))}
        </ul>
        {rest.length > 0 ? (
          <details className="mt-3" data-ticket-packages>
            <summary className="cursor-pointer font-rd text-sm font-semibold text-rd-ink-soft">
              Show {rest.length} more ticket {rest.length === 1 ? 'package' : 'packages'}
            </summary>
            <ul className="mt-3 space-y-3">
              {rest.map((p, i) => (
                <PackageRow key={`tp-${TICKET_PACKAGES_VISIBLE + i}`} promo={p} />
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </section>
  );
}
