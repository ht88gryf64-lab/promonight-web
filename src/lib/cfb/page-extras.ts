// CFB page extras (Phase 3 theming): adapters that let the SITE-STANDARD affiliate
// CTAs (TicketsBlock/HotelsCTA/ParkingCTA) render UNCHANGED with CFB data, plus the
// team "kicker" chant map for the immersive hero. The CTAs are reused as-is — the
// theming reskins the ENVIRONMENT around them, never the CTAs themselves.

import type { Team, Venue } from '@/lib/types';
import type { CfbSchool, CfbVenue } from '@/lib/cfb/types';
import type { CfbSchoolPage } from '@/lib/cfb/data';
import { slugifySchool } from '@/lib/cfb/rules';
import { CFB_FANATICS_STORES } from '@/lib/cfb/fanatics-stores';

// Prose date for the rivalry sentences — em-dash-free (house rule), comma only:
// "Saturday, November 28".
function proseDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

/**
 * Rivalry-section prose — closes Google's "Missing: rivalry" gap. One em-dash-free
 * sentence per tagged rivalry game, DATA-DERIVED ONLY (cfbRivalries name/trophy +
 * schedule, never invented): each uses the word "rivalry" and names the rival
 * explicitly. Extracted as a pure function so the template renders it and the
 * metadata gate verifies the exact same output.
 *
 * Rules:
 *  - Deduped by opponent + rivalry name (a school can carry the same matchup twice —
 *    e.g. a neutral-site home/away pair — and would otherwise repeat a sentence).
 *  - `ident` prefers an EVOCATIVE rivalry name ("The Game", "Iron Bowl") over an
 *    obscure trophy; falls to the trophy ("Golden Hat", "Paul Bunyan's Axe"); a bare
 *    "SchoolA–SchoolB" label is NOT evocative, so it is dropped (the rival is already
 *    named), and a name that already contains "rivalr" is not echoed.
 *  - Venue is named ONLY for a true home or away game (opponent venue for aways),
 *    never a neutral site (Red River at the Cotton Bowl is neither team's stadium).
 */
export function buildRivalrySentences(data: CfbSchoolPage): string[] {
  const { school, venue } = data;
  const ourName = school.shortName || school.name;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const g of data.games) {
    if (!g.rivalry) continue;
    const key = `${g.opponentId}|${g.rivalry.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const rival = g.opponentName;
    const nm = (g.rivalry.name || '').trim();
    const tr = (g.rivalry.trophy || '').trim();
    const isLabel = (str: string) => /–/.test(str) && (str.includes(ourName) || str.includes(rival));
    let ident = '';
    if (nm && nm !== tr && !isLabel(nm) && !/rivalr/i.test(nm)) ident = nm; // evocative name
    else if (tr && !isLabel(tr)) ident = tr; // trophy
    else if (nm && !isLabel(nm) && !/rivalr/i.test(nm)) ident = nm; // name === trophy ("Illibuck")
    const identClause = ident ? `, known as ${ident},` : '';
    const where = g.isHome && !g.neutralSite && venue ? ` at ${venue.name}`
      : !g.isHome && !g.neutralSite && g.awayVenue ? ` at ${g.awayVenue.name}`
      : '';
    out.push(`The ${ourName} vs ${rival} rivalry${identClause} is played on ${proseDate(g.date)}${where}.`);
  }
  return out;
}

// TicketNetwork slug overrides (audit/cfb-affiliate-validation.md). TN fuzzy-serves
// a 200 for unknown slugs, so the default `slugifySchool(name+mascot)` lands on the
// WRONG performer for these 6 — verified by RENDERED title/body, not a 200 (e.g.
// "ole-miss-rebels" → "Gay Ole Opry", "nc-state-wolfpack" → "NC State Symphonic
// Band"). These are the confirmed-correct TN performer slugs. Same idea as the pro
// TICKETNETWORK_OVERRIDES table, but applied to the CFB ticketNetworkSlug.
const CFB_TN_SLUG_OVERRIDES: Record<string, string> = {
  'ole-miss': 'mississippi-rebels',
  'nc-state': 'north-carolina-state-wolfpack',
  'south-florida': 'south-florida-bulls',
  army: 'army-west-point-black-knights',
  smu: 'smu-mustangs-football',
  'appalachian-state': 'appalachian-state-mountaineers',
};

/** cfbSchool -> a Team-shaped object for the affiliate CTAs. The CTAs use a subset
 *  (name/id/city/ticketmasterSlug); the rest are filled with CFB values. TM has no
 *  attraction id for CFB, so buildTicketmasterUrl falls back to `/{slug}-tickets` —
 *  we pass the FULL football team slug ("minnesota-golden-gophers") so it resolves
 *  to the Gophers, not the Twins. */
export function toAffiliateTeam(school: CfbSchool, city?: string | null): Team {
  const fullName = `${school.name} ${school.mascot}`.trim();
  return {
    id: school.id,
    city: city || '',
    name: fullName,
    abbreviation: school.shortName || school.name,
    primaryColor: school.primaryColor || '#000000',
    secondaryColor: school.secondaryColor || '#FFFFFF',
    league: 'ncaaf',
    sportSlug: 'cfb',
    division: school.conferenceBySeason?.['2026'] || '',
    // Both ticket vendors resolve to the FULL football slug ("minnesota-golden-
    // gophers"), not the short school id — so TM and TicketNetwork both land on
    // the team, not the pro club / an ambiguous performer.
    ticketmasterSlug: slugifySchool(fullName),
    ticketNetworkSlug: CFB_TN_SLUG_OVERRIDES[school.id] ?? slugifySchool(fullName),
    // Deep-linked Fanatics college store (discovered, right-school-validated).
    // buildFanaticsUrl wraps it in the Impact /c/ redirect with subId1=web_cfb_{id}.
    // Undefined for any unmapped school → FanaticsCTA renders null (no broken link).
    fanaticsUrl: CFB_FANATICS_STORES[school.id],
  } as Team;
}

/** cfbVenue -> a Venue-shaped object for HotelsCTA/ParkingCTA (route by lat/lng;
 *  0/0 falls the builders back to the city). */
export function toAffiliateVenue(venue: CfbVenue, school: CfbSchool): Venue {
  return {
    name: venue.name,
    address: [venue.city, venue.state].filter(Boolean).join(', '),
    team: `${school.name} ${school.mascot}`,
    sport: 'football',
    sportIcon: '\u{1F3C8}',
    primaryColor: school.primaryColor || '#000000',
    accentColor: school.secondaryColor || '#FFFFFF',
    lat: venue.lat ?? 0,
    lng: venue.lng ?? 0,
    hasAmenityData: false,
    amenityCount: 0,
    league: 'ncaaf',
    teamId: school.id,
  } as Venue;
}

// Curated team "kicker" — the chant/motto for the immersive hero ("Ski-U-Mah",
// "We Are"). Rendered in the contrast-safe accent color. Schools without a
// well-known chant simply omit the kicker (the hero degrades cleanly to name +
// conference + venue + stat strip). No forced/wrong chants.
export const CFB_KICKERS: Record<string, string> = {
  minnesota: 'Ski-U-Mah', 'penn-state': 'We Are', texas: "Hook 'Em", oklahoma: 'Boomer Sooner',
  alabama: 'Roll Tide', auburn: 'War Eagle', lsu: 'Geaux Tigers', georgia: 'Go Dawgs',
  florida: 'Go Gators', tennessee: 'Rocky Top', 'ohio-state': 'O-H-I-O', michigan: 'Go Blue',
  wisconsin: 'On, Wisconsin', 'notre-dame': 'Go Irish', usc: 'Fight On', oregon: 'Go Ducks',
  washington: 'Bow Down', nebraska: 'Go Big Red', clemson: 'All In', 'florida-state': "Go 'Noles",
  miami: 'The U', 'texas-am': "Gig 'Em", arkansas: 'Woo Pig Sooie', missouri: 'M-I-Z',
  'west-virginia': "Let's Go Mountaineers", 'virginia-tech': 'Enter Sandman', 'kansas-state': 'EMAW',
  iowa: 'Go Hawks', 'ole-miss': 'Hotty Toddy', 'michigan-state': 'Go Green', ucla: '8-Clap',
  colorado: 'Go Buffs', utah: 'Go Utes', byu: 'Rise and Shout', 'boise-state': 'Bleed Blue',
  syracuse: "Let's Go Orange", pittsburgh: 'Hail to Pitt', louisville: 'Go Cards',
  'north-carolina': 'Go Heels', duke: 'Go Duke', 'nc-state': 'Go Pack', navy: 'Go Navy',
  army: 'Go Army', 'air-force': 'Go Falcons', tcu: 'Go Frogs', baylor: "Sic 'Em",
  'texas-tech': 'Guns Up', houston: 'Go Coogs', cincinnati: 'Go Bearcats', smu: 'Pony Up',
  kansas: 'Rock Chalk', 'south-carolina': 'Go Cocks', kentucky: 'Go Cats', vanderbilt: 'Anchor Down',
  'mississippi-state': 'Hail State',
};
export function getKicker(schoolId: string): string | null {
  return CFB_KICKERS[schoolId] || null;
}
