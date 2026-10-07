import {
  allDietaryTags,
  dietaryTagLabel,
  groupVendors,
  vendorSources,
  vendorWhere,
  type VendorEntry,
  type VendorGroup,
  type VenueVendor,
} from '@/lib/venue-vendors';
import { Card, CardLabel, ClaimLine } from './venue-logistics';

// "Food & drink": the building's stands, from venueHubs/{slug}/vendors, grouped
// the way the app's Game Day vendors tab groups them (level, then "By section",
// then "Other locations"; a stand at several locations is listed under each).
// Server component; the vendors arrive already filtered by getVenueHubVendors
// (verified building, no tombstoned or suite-only stands) and already stripped
// of bookkeeping by the mapper.
//
// Sources close the card rather than repeating under every stand: a building's
// stands come from one or two pages, so one line per page, each with the
// earliest read date of the stands it lists, says the same thing without
// printing "Source read Oct 7, 2026" fifty times.

function formatReadOn(iso: string | null): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(t));
}

/** Rows shown before the "Show all" control (Matt, 2026-10-07). */
export const VENDORS_VISIBLE = 12;

function EntryRow({ e }: { e: VendorEntry }) {
  const where = vendorWhere(e);
  const tags = allDietaryTags(e.vendor);
  const items = e.vendor.items.map((it) => (it.isNew ? `${it.name} (new)` : it.name)).join(', ');
  return (
    <li className="border-b border-rd-line py-2 font-rd text-[13px] leading-[1.45] text-rd-ink">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <strong>{e.vendor.name}</strong>
        {where ? <span className="text-[12px] text-rd-ink-soft">{where}</span> : null}
      </div>
      {items ? <div className="mt-0.5 text-[12px] text-rd-ink-soft">{items}</div> : null}
      {tags.length || e.vendor.isSignature ? (
        <div className="mt-1 flex flex-wrap gap-1">
          {e.vendor.isSignature ? (
            <span className="rounded-full border border-rd-line px-2 py-0.5 text-[10.5px] font-semibold text-rd-ink-soft">Signature</span>
          ) : null}
          {tags.map((t) => (
            <span key={t} className="rounded-full border border-rd-line px-2 py-0.5 text-[10.5px] font-semibold text-rd-ink-soft">
              {dietaryTagLabel(t)}
            </span>
          ))}
        </div>
      ) : null}
    </li>
  );
}

/** The groups as rendered blocks. `continued` marks a group whose first rows
 *  sit above the fold, so its remainder carries no second heading. */
function Groups({ groups }: { groups: Array<VendorGroup & { continued?: boolean }> }) {
  return (
    <>
      {groups.map((g) => (
        <div key={g.title} className="mt-3 first:mt-0">
          {g.continued ? null : (
            <h3 className="m-0 mb-1.5 font-rd text-[11px] font-bold uppercase tracking-[0.08em] text-rd-ink-soft">{g.title}</h3>
          )}
          <ul className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
            {g.entries.map((e, i) => (
              <EntryRow key={`${e.vendor.id}:${e.location?.raw ?? ''}:${i}`} e={e} />
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

/** Splits the grouped rows after the first `n`, keeping each side grouped and
 *  in order. Exported for the test. */
export function splitGroups(groups: VendorGroup[], n: number) {
  const shown: VendorGroup[] = [];
  const rest: Array<VendorGroup & { continued?: boolean }> = [];
  let left = n;
  for (const g of groups) {
    if (left >= g.entries.length) {
      shown.push(g);
      left -= g.entries.length;
    } else if (left > 0) {
      shown.push({ ...g, entries: g.entries.slice(0, left) });
      rest.push({ ...g, entries: g.entries.slice(left), continued: true });
      left = 0;
    } else {
      rest.push(g);
    }
  }
  return { shown, rest };
}

export function VendorsCard({ vendors }: { vendors: VenueVendor[] }) {
  if (!vendors.length) return null;
  const groups = groupVendors(vendors);
  const sources = vendorSources(vendors);
  const { shown, rest } = splitGroups(groups, VENDORS_VISIBLE);
  // Every stand is in the server-rendered HTML, the folded ones inside a
  // native <details>: no client fetch and no script, so a crawler reads all of
  // them (Matt, 2026-10-07). N counts stands, not rows: a stand at three
  // sections is three rows but one stand.
  return (
    <Card>
      <CardLabel>Food &amp; drink</CardLabel>
      <Groups groups={shown} />
      {rest.length ? (
        <details className="group mt-2">
          <summary className="cursor-pointer list-none py-2 font-rd text-[12px] font-semibold text-rd-red [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Show all {vendors.length} stands &rsaquo;</span>
            <span className="hidden group-open:inline">Show fewer stands &lsaquo;</span>
          </summary>
          <Groups groups={rest} />
        </details>
      ) : null}
      <div className="mt-2">
        {sources.map((s) => (
          <ClaimLine key={s.url} sourceUrl={s.url} verifiedOn={formatReadOn(s.observedAt)} />
        ))}
      </div>
    </Card>
  );
}
