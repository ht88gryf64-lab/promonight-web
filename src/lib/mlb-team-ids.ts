// MLB Stats API team IDs → PromoNight team slugs.
// IDs are stable. Reference: https://statsapi.mlb.com/api/v1/teams?sportId=1
// Slugs match the Firestore `teams` doc id (also the URL segment for team pages).

export const MLB_TEAM_ID_TO_SLUG: Record<number, string> = {
  108: 'los-angeles-angels',
  109: 'arizona-diamondbacks',
  110: 'baltimore-orioles',
  111: 'boston-red-sox',
  112: 'chicago-cubs',
  113: 'cincinnati-reds',
  114: 'cleveland-guardians',
  115: 'colorado-rockies',
  116: 'detroit-tigers',
  117: 'houston-astros',
  118: 'kansas-city-royals',
  119: 'los-angeles-dodgers',
  120: 'washington-nationals',
  121: 'new-york-mets',
  133: 'oakland-athletics',
  134: 'pittsburgh-pirates',
  135: 'san-diego-padres',
  136: 'seattle-mariners',
  137: 'san-francisco-giants',
  138: 'st-louis-cardinals',
  139: 'tampa-bay-rays',
  140: 'texas-rangers',
  141: 'toronto-blue-jays',
  142: 'minnesota-twins',
  143: 'philadelphia-phillies',
  144: 'atlanta-braves',
  145: 'chicago-white-sox',
  146: 'miami-marlins',
  147: 'new-york-yankees',
  158: 'milwaukee-brewers',
};

export function mlbIdToSlug(id: number): string | undefined {
  return MLB_TEAM_ID_TO_SLUG[id];
}
