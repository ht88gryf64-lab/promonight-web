import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { getTeamBySlug } from '@/lib/data';
import { getPastPromoEditions, isPromoPagesLive } from '@/lib/promo-pages';
import { siteTodayYmd } from '@/lib/site-today';
import { PastPromosView, pastPromosHead } from '@/components/promo-page/PastPromosView';

// /{league}/{team}/promos/past (archive pass, step 6, 2026-11-08): the team's
// played promotions by season, newest first. A static segment under promos/,
// so it wins over [slug]; no promo carries the slug "past". Indexable, in
// /sitemap.xml, canonical self. A team with no played promo answers 404,
// not an empty page. Rebuilt daily, like the promo pages: a game that was
// played today joins the archive tomorrow.
export const revalidate = 86400;
export const dynamicParams = true;

export async function generateStaticParams(): Promise<{ sport: string; team: string }[]> {
  return [];
}

type Params = Promise<{ sport: string; team: string }>;

const todayForRequest = cache(() => siteTodayYmd());

const resolve = cache(async (params: Params) => {
  const { sport, team: teamSlug } = await params;
  const team = await getTeamBySlug(teamSlug);
  if (!team || team.sportSlug !== sport) return null;
  const today = todayForRequest();
  const seasons = await getPastPromoEditions(team, today);
  if (!seasons.length) return null;
  return { team, seasons, today };
});

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  if (!isPromoPagesLive()) return {};
  const r = await resolve(params);
  if (!r) return {};
  const head = pastPromosHead(r.team, r.seasons);
  return {
    title: head.title,
    description: head.description,
    alternates: { canonical: head.canonical },
    openGraph: { type: 'website', siteName: 'PromoNight', url: head.canonical, title: `${head.title} | PromoNight`, description: head.description },
  };
}

export default async function PastPromosPage({ params }: { params: Params }) {
  if (!isPromoPagesLive()) notFound();
  const r = await resolve(params);
  if (!r) notFound();
  return <PastPromosView team={r.team} seasons={r.seasons} />;
}
