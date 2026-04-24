// Per-venue "plan your visit" details that aren't in Firestore yet. Merged
// into the Venue object after the Firestore fetch so render code can treat
// both sources uniformly. When Matt populates Firestore with these fields,
// this file can shrink to empty and eventually be deleted.
//
// Keys are team slugs (Firestore team doc id / route segment).

export interface VenueOverride {
  parkingInfo?: string;
  publicTransit?: string;
  bagPolicyUrl?: string;
  accessibility?: string;
  nearby?: string;
}

export const VENUE_OVERRIDES: Record<string, VenueOverride> = {
  'minnesota-twins': {
    parkingInfo:
      'Target Field ramps sell out on giveaway and marquee dates. Pre-paid parking is the safest bet — reserve a spot in advance rather than circling the ramps.',
    publicTransit:
      'METRO Blue and Green lines stop at Target Field Station, directly connected to the stadium. Northstar commuter rail also terminates at the stadium.',
    bagPolicyUrl:
      'https://www.mlb.com/twins/ballpark/information/guide#bag-policy',
    accessibility:
      'Target Field is fully ADA-accessible with wheelchair seating throughout, elevators to every level, and accessible parking in Ramp A.',
    nearby:
      'The North Loop and Warehouse District are steps from the ballpark — try Modist Brewing, The Freehouse, or Red Cow for pregame bites.',
  },
  'kansas-city-royals': {
    parkingInfo:
      'General-parking lots around Kauffman Stadium fill up quickly on giveaway nights and fireworks games. Reserve pre-paid parking or arrive 90+ minutes early.',
    publicTransit:
      'The Truman Sports Complex is not on a rail line. RideKC runs game-day bus service from downtown; most fans drive or rideshare.',
    bagPolicyUrl:
      'https://www.mlb.com/royals/ballpark/information/stadium-policies',
    accessibility:
      'Kauffman Stadium has accessible entrances, elevators to each level, and ADA-designated parking in Lots K and M.',
    nearby:
      'Arrowhead Stadium is next door in the same complex — but restaurants and bars are 10–15 minutes west in the Power & Light District, Westport, and the Crossroads.',
  },
  'toronto-blue-jays': {
    parkingInfo:
      'The Rogers Centre has limited on-site parking; most fans use paid garages within a 5–10 minute walk (John St, Front St, Simcoe). Book ahead on weekends.',
    publicTransit:
      'Union Station is one block north — served by the TTC subway (Line 1), GO Transit regional rail, and the UP Express to Pearson Airport. Easiest rapid transit in the majors.',
    bagPolicyUrl:
      'https://www.mlb.com/bluejays/ballpark/information/guide#bag-policy',
    accessibility:
      'Rogers Centre is fully accessible with wheelchair-accessible seating, elevators, and service-animal relief areas.',
    nearby:
      'Real Sports Bar & Grill, Steam Whistle Brewing (literally next door), and the CN Tower are all within a five-minute walk.',
  },
  'dallas-cowboys': {
    parkingInfo:
      'AT&T Stadium sells all parking in advance on Cowboys game days — every lot requires a pre-purchased pass. Reserve through the official team site or a third-party marketplace well before gameday.',
    publicTransit:
      'Trinity Railway Express does not serve AT&T Stadium directly. Most fans drive; rideshare drop-off zones are set up on game days but expect significant traffic 2+ hours pre-kickoff.',
    bagPolicyUrl:
      'https://www.dallascowboys.com/stadium/gameday/stadium-policies',
    accessibility:
      'AT&T Stadium offers accessible seating, elevators to every level, and wheelchair-accessible shuttle service from designated parking lots.',
    nearby:
      'Globe Life Field (Rangers) is across the parking lot. Texas Live! is the adjacent entertainment complex — restaurants and bars open hours before kickoff.',
  },
  'oklahoma-city-thunder': {
    parkingInfo:
      'Paycom Center parking lots fill up fast on Thunder game nights. Nearby garages (Arts District, Cox Convention Center) offer cheaper alternatives within a short walk.',
    publicTransit:
      'OKC Streetcar stops directly at Paycom Center (Arena Station) and connects Bricktown and downtown — a frequent ride on game nights.',
    bagPolicyUrl:
      'https://www.nba.com/thunder/tickets/arena-policies',
    accessibility:
      'Paycom Center is fully ADA-accessible with wheelchair seating on every level, elevator access, and designated accessible parking.',
    nearby:
      'Bricktown is a five-minute walk — try Bricktown Brewery, Mickey Mantle\'s Steakhouse, or Fassler Hall for pregame.',
  },
};

export function getVenueOverride(teamId: string): VenueOverride | undefined {
  return VENUE_OVERRIDES[teamId];
}
