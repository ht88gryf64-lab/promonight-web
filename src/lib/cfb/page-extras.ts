// CFB page extras (Phase 3 theming): adapters that let the SITE-STANDARD affiliate
// CTAs (TicketsBlock/HotelsCTA/ParkingCTA) render UNCHANGED with CFB data, plus the
// team "kicker" chant map for the immersive hero. The CTAs are reused as-is — the
// theming reskins the ENVIRONMENT around them, never the CTAs themselves.

import type { Team, Venue } from '@/lib/types';
import type { CfbSchool, CfbVenue } from '@/lib/cfb/types';
import { slugifySchool } from '@/lib/cfb/rules';

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
    ticketNetworkSlug: slugifySchool(fullName),
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
