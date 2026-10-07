import {
  allDietaryTags,
  dietaryTagLabel,
  groupVendors,
  vendorSources,
  vendorWhere,
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

export function VendorsCard({ vendors }: { vendors: VenueVendor[] }) {
  if (!vendors.length) return null;
  const groups = groupVendors(vendors);
  const sources = vendorSources(vendors);
  return (
    <Card>
      <CardLabel>Food &amp; drink</CardLabel>
      {groups.map((g) => (
        <div key={g.title} className="mt-3 first-of-type:mt-0">
          <h3 className="m-0 mb-1.5 font-rd text-[11px] font-bold uppercase tracking-[0.08em] text-rd-ink-soft">{g.title}</h3>
          <ul className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
            {g.entries.map((e, i) => {
              const where = vendorWhere(e);
              const tags = allDietaryTags(e.vendor);
              const items = e.vendor.items.map((it) => (it.isNew ? `${it.name} (new)` : it.name)).join(', ');
              return (
                <li key={`${e.vendor.id}:${i}`} className="border-b border-rd-line py-2 font-rd text-[13px] leading-[1.45] text-rd-ink">
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
            })}
          </ul>
        </div>
      ))}
      <div className="mt-2">
        {sources.map((s) => (
          <ClaimLine key={s.url} sourceUrl={s.url} verifiedOn={formatReadOn(s.observedAt)} />
        ))}
      </div>
    </Card>
  );
}
