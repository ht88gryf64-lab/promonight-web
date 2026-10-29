// What a matchup page LEADS with, and the guard against two pages leading with
// the same string. Pure and Firestore-free so both are unit-testable.

import type { MatchupRegistryEntry } from '@/lib/cfb/matchup-registry';

/** The name a page LEADS with. The editorial override when present, otherwise
 *  the rivalry doc's own name. Drives the H1, the title and the rail label so
 *  all three stay in step. */
export function resolveMatchupDisplayName(
  entry: Pick<MatchupRegistryEntry, 'displayName'> | null | undefined,
  rivalryName: string,
): string {
  return entry?.displayName?.trim() || rivalryName;
}

/** Any display name claimed by more than one slug.
 *
 *  Two pages leading with one string compete against each other, which is
 *  exactly what shipped when both Victory Bell rivalries rendered
 *  "Victory Bell 2026". Pure so it can be unit-tested, and run over live data
 *  at build time by the index loader. */
export function findDisplayNameCollisions(
  rows: Array<{ slug: string; name: string }>,
): Array<{ name: string; slugs: string[] }> {
  const bySeen = new Map<string, string[]>();
  for (const r of rows) {
    const k = r.name.trim().toLowerCase();
    if (!bySeen.has(k)) bySeen.set(k, []);
    bySeen.get(k)!.push(r.slug);
  }
  return [...bySeen.entries()]
    .filter(([, slugs]) => slugs.length > 1)
    .map(([, slugs]) => ({ name: rows.find((r) => r.slug === slugs[0])!.name, slugs }));
}

// ── Untracked school ids that do not title-case into their name ──────────────
//
// A school with no cfbSchools doc is named from its game-row id, and
// title-casing "uab" gives "Uab" and "miami-oh" gives "Miami Oh", both of
// which reached live descriptions ("The Bones vs Uab", "Victory Bell vs Miami
// Oh"). This map is consulted by both prettifiers (prettySchoolId in
// matchup-description.ts, prettifySlug in data.ts) before they fall back to
// title-casing, so every surface names an untracked school the same way. Ids
// that title-case correctly are deliberately absent. Several ids here are
// aliases of tracked schools ("iowa-st", "jmu", "niu", "usf", "cal"): the row
// keeps its alias id, so this only fixes the display; linking the row to the
// tracked school is a pipeline data fix.
export const SCHOOL_ID_DISPLAY_NAMES: Readonly<Record<string, string>> = {
  'arizona-st': 'Arizona State',
  'arkansas-pine-bluff': 'Arkansas-Pine Bluff',
  'bethune-cookman': 'Bethune-Cookman',
  cal: 'California',
  ecu: 'East Carolina',
  fau: 'FAU',
  fiu: 'FIU',
  'florida-am': 'Florida A&M',
  'gardner-webb': 'Gardner-Webb',
  'iowa-st': 'Iowa State',
  jmu: 'James Madison',
  liu: 'LIU',
  mcneese: 'McNeese',
  'miami-fla': 'Miami (FL)',
  'miami-oh': 'Miami (OH)',
  ndsu: 'North Dakota State',
  niu: 'Northern Illinois',
  'oklahoma-st': 'Oklahoma State',
  'prairie-view-am': 'Prairie View A&M',
  'san-jos-state': 'San Jose State',
  uab: 'UAB',
  'uc-davis': 'UC Davis',
  ulm: 'UL Monroe',
  umass: 'UMass',
  uni: 'Northern Iowa',
  unr: 'Nevada',
  usf: 'USF',
  'ut-martin': 'UT Martin',
  utep: 'UTEP',
  utsa: 'UTSA',
  vmi: 'VMI',
  'william-mary': 'William & Mary',
};

/** The mapped display name for an untracked school id, or null when the id
 *  title-cases correctly and needs no entry. */
export function schoolIdDisplayName(id: string): string | null {
  return SCHOOL_ID_DISPLAY_NAMES[id] ?? null;
}
