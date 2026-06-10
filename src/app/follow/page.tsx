import type { Metadata } from 'next';
import { getAllTeams } from '@/lib/data';
import { archivoHouse } from '@/components/redesign/fonts-house';
import { coerceCaptureSurface } from '@/lib/follow-surface';
import { getNearTeamIds } from '@/lib/geo/near-teams';
import { FollowForm } from '@/components/follow/FollowForm';

// Combined capture page. Server-rendered: loads all teams for the selector and
// resolves entry context (?team pre-stars a team, ?source tags the surface).
// Global chrome (brand bar + footer) comes from the root layout; this page
// renders the charcoal hero + cream body inside the light-house rd-root scope,
// matching /my-teams and the aggregator pages.
export const metadata: Metadata = {
  title: 'Follow Your Teams: Free Promo Alerts',
  description:
    'Star your favorite MLB, NBA, NFL, NHL, MLS, and WNBA teams and get one weekly email with every giveaway, theme night, and food deal coming up.',
  alternates: { canonical: '/follow' },
  openGraph: {
    title: 'Follow Your Teams on PromoNight',
    description:
      'One weekly email with every giveaway, theme night, and food deal for the teams you star.',
    url: 'https://www.getpromonight.com/follow',
  },
  robots: { index: true, follow: true },
};

// Per-request: getNearTeamIds reads the live Vercel geo headers, and the page
// already reads searchParams, so it renders dynamically.
export const dynamic = 'force-dynamic';

export default async function FollowPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string; source?: string }>;
}) {
  const { team, source } = await searchParams;
  const teams = await getAllTeams();
  const surface = coerceCaptureSurface(source);

  // Only pre-star a slug that resolves to a real team, so a stale or hand-typed
  // ?team= can't seed a phantom selection.
  const seededTeam =
    typeof team === 'string' ? teams.find((t) => t.id === team) ?? null : null;
  const initialTeam = seededTeam?.id ?? null;

  // Soft geo ordering: nearest teams float to the top of the picker. Empty when
  // there is no usable geo signal (default order, no group). Never filters.
  const nearTeamIds = await getNearTeamIds(teams);

  return (
    <div className={`${archivoHouse.variable} rd-root min-h-screen`}>
      <section
        className="relative overflow-hidden text-white"
        style={{ backgroundColor: '#1d1714' }}
      >
        <div
          aria-hidden
          className="absolute inset-0 z-0 opacity-70"
          style={{
            backgroundImage:
              'radial-gradient(120% 80% at 100% 0%, rgba(211,17,69,0.22) 0%, transparent 60%)',
          }}
        />
        <div className="relative z-10 mx-auto max-w-2xl px-6 pb-12 pt-16 md:pb-14 md:pt-20">
          <p
            className="font-rd text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: '#ff5a78' }}
          >
            Free weekly email
          </p>
          <h1 className="rd-display mt-1 text-4xl uppercase leading-[0.95] text-white md:text-5xl">
            Never miss a giveaway
          </h1>
          <p className="mt-4 max-w-xl font-rd text-base leading-relaxed text-white/70">
            {seededTeam
              ? `Get every ${seededTeam.city} ${seededTeam.name} bobblehead, theme night, and food deal, plus any other teams you star, in one email a week.`
              : 'Star your teams and get every giveaway, theme night, and food deal coming up in one email a week.'}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-2xl px-6 pb-20 pt-8">
        <FollowForm
          teams={teams}
          initialTeam={initialTeam}
          surface={surface}
          nearTeamIds={nearTeamIds}
        />
      </div>
    </div>
  );
}
