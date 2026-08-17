import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAllMatchupSlugs, getMatchupPage } from '@/lib/cfb/matchups';
import { buildCfbMatchupMetadata } from '@/lib/cfb/metadata';
import { buildRivalryMatchupJsonLd } from '@/lib/cfb/rivalry-jsonld';
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

  // displayName, not rivalry.name, so title, H1 and description all agree. The
  // builder also supplies the canonical and a self-referencing og:url, which
  // this route shipped without.
  return buildCfbMatchupMetadata(data);
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getMatchupPage(slug);
  if (!data) notFound();

  // BreadcrumbList (backing the visual breadcrumb) + SportsEvent for the 2026
  // game. Kickoff and broadcast ride the verify gate inside the builder: an
  // unverified game emits a bare date and no network, never a placeholder.
  const schemas = buildRivalryMatchupJsonLd(data);

  // Deliberately does NOT mount CfbThemePersist and does NOT theme itself in
  // either school's colour. A rivalry has two schools, so a single-school
  // persist write would be ambiguous, and theming in one school's colour picks
  // a side. The schools appear only as the two accents.
  return (
    <>
      {schemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      <RivalryMatchupPage data={data} />
    </>
  );
}
