import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getPromosFromDate } from '@/lib/data';
import type { PromoWithTeam } from '@/lib/types';
import { relLuminance } from '@/lib/chip-contrast';
import { pickHeroBuckets } from '@/components/tonight-strip';
import { pickBestStubPromos } from '@/components/redesign/pick-best-stub-promos';
import { archivoHouse } from '@/components/redesign/fonts-house';
import { TicketStubPreview } from './preview-client';

// Dev-only preview of the ticket-stub promo card at real data density.
// Gates on VERCEL_ENV (not NODE_ENV, unlike dev/ad-slots): Vercel preview
// deployments build with NODE_ENV=production, and this page exists precisely
// to be reviewed on a preview URL. Production serves 404.
export const metadata: Metadata = { robots: { index: false, follow: false } };
export const revalidate = 0;

function chicagoTodayYMD(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// Curate a review set from live data, deterministically: two promos per type
// (longest titles first, one team each), plus the darkest- and lightest-color
// teams in the future corpus, plus a guaranteed HOT promo. No hardcoded teams.
function curate(all: PromoWithTeam[]): PromoWithTeam[] {
  const picked: PromoWithTeam[] = [];
  const usedTeams = new Set<string>();
  const key = (p: PromoWithTeam) => `${p.team.id}::${p.date}::${p.title}`;
  const usedKeys = new Set<string>();
  const add = (p: PromoWithTeam | undefined) => {
    if (!p || usedKeys.has(key(p))) return;
    usedKeys.add(key(p));
    usedTeams.add(p.team.id);
    picked.push(p);
  };

  for (const type of ['giveaway', 'theme', 'food', 'kids'] as const) {
    const pool = all
      .filter((p) => p.type === type)
      .sort((a, b) => b.title.length - a.title.length);
    add(pool.find((p) => !usedTeams.has(p.team.id)));
    add(pool.find((p) => !usedKeys.has(key(p)) && !usedTeams.has(p.team.id)));
  }

  const byLum = [...all].sort(
    (a, b) => relLuminance(a.team.primaryColor ?? '#000000') - relLuminance(b.team.primaryColor ?? '#000000'),
  );
  add(byLum[0]);
  add(byLum[byLum.length - 1]);
  if (!picked.some((p) => p.highlight)) add(all.find((p) => p.highlight));

  return picked.sort((a, b) => a.date.localeCompare(b.date));
}

export default async function TicketStubPreviewPage() {
  if (process.env.VERCEL_ENV === 'production') {
    notFound();
  }

  const todayYMD = chicagoTodayYMD();
  const allFuture = await getPromosFromDate(todayYMD);
  const promos = curate(allFuture);
  // Real tonight bucket via the exact picker the homepage uses; allFuture is
  // a superset of the homepage's 14-day window and the picker only matches
  // dates inside its own sets, so no new query pattern is introduced.
  const tonight = pickHeroBuckets(allFuture, todayYMD).tonight;
  // Server-side pick so only the top N serialize to the client.
  const best = pickBestStubPromos(allFuture, 8);

  return (
    <div className={`${archivoHouse.variable} rd-root min-h-screen bg-rd-cream`}>
      <TicketStubPreview promos={promos} tonight={tonight} best={best} />
    </div>
  );
}
