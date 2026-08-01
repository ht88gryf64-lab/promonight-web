import { notFound } from 'next/navigation';
import { archivoHouse } from '@/components/redesign/fonts-house';
import { getTeamBySlug, getTeamPromos, promoBoardChicagoYMD } from '@/lib/data';
import type { VenueHubWeekPromo } from '@/lib/venue-hub';
import { HubPromosThisWeek } from '@/components/venue-hub/HubPromosThisWeek';

// Dev-only preview of the venue-hub "Promos this week" scroller in its
// MULTI-TENANT state. Not exposed in production builds.
//
// Why this exists: the multi-tenant team marker only turns on when two or more
// tenants of one building have promos in the SAME 7-day window, and no real
// building satisfies that on every date of the year (the shared arenas pair an
// in-season tenant with an off-season one, e.g. Lynx + Timberwolves in August).
// The single-tenant state is verifiable on any live hub; this page is the only
// way to see the other branch on demand.
//
// The promos are REAL (two teams' actual this-week promos, read through the same
// getTeamPromos the hub uses); only the pairing into one building is synthetic.
const LEFT_TEAM = 'seattle-mariners';
const RIGHT_TEAM = 'minnesota-lynx';

export default async function VenuePromosDebugPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  const start = promoBoardChicagoYMD(0);
  const end = promoBoardChicagoYMD(7);

  const items: VenueHubWeekPromo[] = [];
  for (const slug of [LEFT_TEAM, RIGHT_TEAM]) {
    const [team, promos] = await Promise.all([getTeamBySlug(slug), getTeamPromos(slug)]);
    if (!team) continue;
    for (const promo of promos) {
      if (promo.date < start || promo.date > end) continue;
      const [sy, sm, sd] = start.split('-').map(Number);
      const [py, pm, pd] = promo.date.split('-').map(Number);
      const daysOut = Math.round((Date.UTC(py, pm - 1, pd) - Date.UTC(sy, sm - 1, sd)) / 86400000);
      items.push({ promo, team, daysOut });
    }
  }
  items.sort(
    (a, b) =>
      a.promo.date.localeCompare(b.promo.date) ||
      a.team.id.localeCompare(b.team.id) ||
      a.promo.title.localeCompare(b.promo.title),
  );

  const single = items.filter((i) => i.team.id === LEFT_TEAM);

  return (
    <div className={`${archivoHouse.variable} rd-root min-h-screen bg-rd-bg`}>
      <div className="mx-auto max-w-[1160px] px-3 py-10 md:px-8">
        <h1 className="rd-display mb-1 text-2xl text-rd-ink">VENUE HUB PROMO SCROLLER (DEV)</h1>
        <p className="mb-8 font-rd text-[13px] text-rd-ink-soft">
          Window {start} to {end}. Real promos, synthetic building pairing.
        </p>

        <div className="mb-10 max-w-[760px]">
          <p className="mb-2 font-rd text-[12px] font-bold uppercase tracking-[0.08em] text-rd-red">
            Multi-tenant ({items.length} cards, {new Set(items.map((i) => i.team.id)).size} teams) — marker ON
          </p>
          <HubPromosThisWeek items={items} buildingSlug="dev-multi-tenant" buildingName="Dev Shared Building" />
        </div>

        <div className="max-w-[760px]">
          <p className="mb-2 font-rd text-[12px] font-bold uppercase tracking-[0.08em] text-rd-red">
            Single-tenant ({single.length} cards, 1 team) — marker OFF
          </p>
          <HubPromosThisWeek items={single} buildingSlug="dev-single-tenant" buildingName="Dev Single Building" />
        </div>
      </div>
    </div>
  );
}
