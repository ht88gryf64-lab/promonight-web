import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { notFound } from 'next/navigation';
import { getAllCfbSchoolIds, getCfbSchoolPage } from '@/lib/cfb/data';
import { resolveCfbTheme, cfbThemeVars } from '@/lib/cfb/theme';
import { CfbSchoolPage } from '@/components/cfb/CfbSchoolPage';

export const revalidate = 21600; // ISR — same cadence as team pages

export async function generateStaticParams() {
  const ids = await getAllCfbSchoolIds();
  return ids.map((school) => ({ school }));
}

export async function generateMetadata({ params }: { params: Promise<{ school: string }> }): Promise<Metadata> {
  const { school } = await params;
  const data = await getCfbSchoolPage(school);
  if (!data) return {};
  const year = 2026; // hardcoded, never getFullYear() (feedback_hardcode_season_year_in_seo_copy)
  const s = data.school;
  const venue = data.venue;
  const title = `${s.name} Football ${year} Schedule & Gameday`;
  const desc = `${s.name} ${year} football schedule${venue ? ` at ${venue.name}` : ''} — every game, opponents, rivalry games with trophies, and gameday info for planning a ${s.shortName} Saturday.`;
  return {
    title,
    description: desc.length > 250 ? desc.slice(0, 247).trimEnd() + '…' : desc,
    alternates: { canonical: `/cfb/${school}` },
  };
}

// Quality floor (decision record §4): a page indexes only if it carries enough
// verified hard data to be useful. A deferred G5 with almost nothing corroborated
// holds noindex until it enriches, rather than shipping a near-empty shell.
function belowIndexFloor(data: Awaited<ReturnType<typeof getCfbSchoolPage>>): boolean {
  if (!data) return true;
  // useful stub = a real schedule (>=8 games) + a resolved venue.
  return data.games.length < 8 || !data.venue;
}

export default async function Page({ params }: { params: Promise<{ school: string }> }) {
  const { school } = await params;
  const data = await getCfbSchoolPage(school);
  if (!data) notFound();

  const theme = resolveCfbTheme(data.school.primaryColor, data.school.secondaryColor);
  const vars = cfbThemeVars(theme) as CSSProperties;

  // Structured data — the corroborated rivalry games with trophy names are citable.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SportsTeam',
    name: data.school.name,
    sport: 'American Football',
    ...(data.venue ? { location: { '@type': 'StadiumOrArena', name: data.venue.name, ...(data.venue.city ? { address: [data.venue.city, data.venue.state].filter(Boolean).join(', ') } : {}) } } : {}),
    event: data.games.slice(0, 20).map((g) => ({
      '@type': 'SportsEvent',
      name: `${data.school.shortName} ${g.isHome ? 'vs' : 'at'} ${g.opponentName}${g.rivalry ? ` (${g.rivalry.trophy || g.rivalry.name})` : ''}`,
      startDate: g.date,
      ...(g.isHome && data.venue ? { location: { '@type': 'StadiumOrArena', name: data.venue.name } } : {}),
    })),
  };

  return (
    <div style={vars} data-cfb-noindex={belowIndexFloor(data) ? 'true' : undefined}>
      {belowIndexFloor(data) && <meta name="robots" content="noindex,follow" />}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <CfbSchoolPage data={data} />
    </div>
  );
}
