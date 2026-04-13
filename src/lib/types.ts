export type PromoType = 'giveaway' | 'theme' | 'kids' | 'food';

export interface Team {
  id: string;
  city: string;
  name: string;
  abbreviation: string;
  primaryColor: string;
  secondaryColor: string;
  league: string;
  sportSlug: string;
  division: string;
}

export interface Promo {
  date: string;
  time: string;
  opponent: string;
  type: PromoType;
  title: string;
  description: string;
  highlight: boolean;
  icon: string;
  recurring: boolean;
}

export interface PromoWithTeam extends Promo {
  team: Team;
}

export interface Venue {
  name: string;
  address: string;
  team: string;
  sport: string;
  sportIcon: string;
  primaryColor: string;
  accentColor: string;
  lat: number;
  lng: number;
  hasAmenityData: boolean;
  amenityCount: number;
  gatesOpen?: string;
  league: string;
  teamId: string;
}

export const PROMO_TYPE_COLORS: Record<PromoType, string> = {
  giveaway: '#34d399',
  theme: '#a78bfa',
  kids: '#60a5fa',
  food: '#fb923c',
};

export const PROMO_TYPE_LABELS: Record<PromoType, string> = {
  giveaway: 'Giveaway',
  theme: 'Theme Night',
  kids: 'Kids',
  food: 'Food Deal',
};

export const LEAGUE_ORDER = ['MLB', 'NBA', 'NFL', 'NHL', 'MLS', 'WNBA'] as const;

export const SPORT_ICONS: Record<string, string> = {
  MLB: '⚾',
  NBA: '🏀',
  NFL: '🏈',
  NHL: '🏒',
  MLS: '⚽',
  WNBA: '🏀',
};
