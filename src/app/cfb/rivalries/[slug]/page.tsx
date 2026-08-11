import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAllMatchupSlugs, getMatchupPage } from '@/lib/cfb/matchups';
import { RivalryMatchupPage } from '@/components/cfb/rivalry/RivalryMatchupPage';

export const revalidate = 21600; // ISR, same cadence as the CFB hub and school pages

export async function generateStaticParams() {
  return getAllMatchupSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getMatchupPage(slug);

  // Deliberately NOT `return {}` the way src/app/cfb/[school]/page.tsx:20 does.
  // A bare {} leaves the page inheriting the root title with no description and
  // no robots directive, so an unknown slug renders as a title-less indexable
  // shell. Since dynamicParams defaults to true, any /cfb/rivalries/<anything>
  // reaches this function, so the miss path has to be explicit.
  if (!data) {
    return {
      title: 'Rivalry not found',
      robots: { index: false, follow: false },
    };
  }

  // Phase 1C fills this in properly (rivalry name leads, trophy is not the
  // headline). Scaffold keeps a real title so the miss path above stays the
  // only branch that can produce an empty one.
  return { title: `${data.rivalry.name} 2026` };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getMatchupPage(slug);
  if (!data) notFound();

  // Deliberately does NOT mount CfbThemePersist and does NOT theme itself in
  // either school's colour. A rivalry has two schools, so a single-school
  // persist write would be ambiguous, and theming in one school's colour picks
  // a side. The schools appear only as the two accents.
  return <RivalryMatchupPage data={data} />;
}
