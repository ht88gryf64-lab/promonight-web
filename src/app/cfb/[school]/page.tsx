import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { notFound } from 'next/navigation';
import { getAllCfbSchoolIds, getCfbSchoolPage } from '@/lib/cfb/data';
import { buildCfbTeamMetadata } from '@/lib/cfb/metadata';
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
  // Tier-derived, rivalry/travel-angled, within engine limits (§12/§13). Hardcoded
  // 2026 lives in the helper (never getFullYear() — feedback_hardcode_season_year).
  return buildCfbTeamMetadata(data);
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

  // Structured data: a standalone SportsTeam object. We intentionally do NOT emit a
  // nested SportsEvent[] schedule. Google's Event rules require every event to carry a
  // location with both name and address; away games have no resolved venue and home
  // games carry only a stadium name, so emitting events tripped a Google rich-results
  // validation notice on all 86 pages. SportsTeam alone is not a rich-result type, so
  // it produces no such error. data.games still drives the visible schedule below.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SportsTeam',
    name: data.school.name,
    sport: 'American Football',
    ...(data.venue ? { location: { '@type': 'StadiumOrArena', name: data.venue.name, ...(data.venue.city ? { address: [data.venue.city, data.venue.state].filter(Boolean).join(', ') } : {}) } } : {}),
  };

  return (
    <div style={vars} data-cfb-noindex={belowIndexFloor(data) ? 'true' : undefined}>
      {belowIndexFloor(data) && <meta name="robots" content="noindex,follow" />}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <CfbSchoolPage data={data} />
    </div>
  );
}
