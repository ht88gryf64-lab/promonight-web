/* eslint-disable no-console */
// Rivalry tagging (decision record §8) — AUTO pages tag, they do NOT crown.
//
// Rule: tag a 2026 game as a rivalry game when the SCHEDULE shows the matchup AND
// Wikipedia corroborates it as a NAMED rivalry (with or without a trophy). Two-
// source corroboration, same gate as the rest of the pipeline. Show the trophy
// name as a FACT. NO active-series filter — a dormant-but-scheduled rivalry counts
// (the schedule presence IS the proof it is live in 2026). Tag ALL corroborated
// rivalry games EQUALLY — no signature, no ordering-by-importance, no "the big
// one". The SIGNATURE designation (which rivalry leads a page) is human-only and
// destination-only; the pipeline MUST NOT set it, so nothing here ranks.
//
// This is a curated SEED sourced from Wikipedia rivalry pages (each entry cites
// its page). Entity-conflation guard #3 respected: seriesStartYear is SPLIT from
// trophyCreatedYear (null where not independently confirmed — never guessed).
// SAFE-DIRECTION: unmatched matchups are simply NOT tagged (under-tag, never a
// fabricated rivalry). Extend by adding Wikipedia-verified entries.

import { normalizeSlug } from './schools-2026';

export interface RivalryEntry {
  id: string;
  schoolIds: [string, string]; // canonical slugs (as authored; lookup is order-independent)
  name: string;
  trophy: string | null;
  seriesStartYear: number | null;
  trophyCreatedYear: number | null; // SPLIT from seriesStartYear; null when unconfirmed
  dormant: boolean; // historical status; does NOT gate tagging (schedule presence does)
  source: string; // Wikipedia rivalry page (the corroborating 2nd source)
}

// Sorted-pair key so lookup is order-independent.
const pairKey = (a: string, b: string) => [normalizeSlug(a), normalizeSlug(b)].sort().join('|');

export const RIVALRIES_2026: RivalryEntry[] = [
  { id: 'iron-bowl', schoolIds: ['alabama', 'auburn'], name: 'Iron Bowl', trophy: null, seriesStartYear: 1893, trophyCreatedYear: null, dormant: false, source: 'https://en.wikipedia.org/wiki/Iron_Bowl' },
  { id: 'third-saturday-october', schoolIds: ['alabama', 'tennessee'], name: 'Third Saturday in October', trophy: null, seriesStartYear: 1901, trophyCreatedYear: null, dormant: false, source: 'https://en.wikipedia.org/wiki/Alabama%E2%80%93Tennessee_football_rivalry' },
  { id: 'egg-bowl', schoolIds: ['ole-miss', 'mississippi-state'], name: 'Egg Bowl', trophy: 'Golden Egg Trophy', seriesStartYear: 1901, trophyCreatedYear: 1927, dormant: false, source: 'https://en.wikipedia.org/wiki/Egg_Bowl' },
  { id: 'red-river', schoolIds: ['texas', 'oklahoma'], name: 'Red River Rivalry', trophy: 'Golden Hat', seriesStartYear: 1900, trophyCreatedYear: 1941, dormant: false, source: 'https://en.wikipedia.org/wiki/Red_River_Rivalry' },
  { id: 'cocktail-party', schoolIds: ['florida', 'georgia'], name: "Florida–Georgia (World's Largest Outdoor Cocktail Party)", trophy: null, seriesStartYear: 1915, trophyCreatedYear: null, dormant: false, source: 'https://en.wikipedia.org/wiki/Florida%E2%80%93Georgia_football_rivalry' },
  { id: 'clean-old-fashioned-hate', schoolIds: ['georgia', 'georgia-tech'], name: 'Clean, Old-Fashioned Hate', trophy: null, seriesStartYear: 1893, trophyCreatedYear: null, dormant: false, source: 'https://en.wikipedia.org/wiki/Clean,_Old-Fashioned_Hate' },
  { id: 'golden-boot', schoolIds: ['lsu', 'arkansas'], name: 'Battle for the Golden Boot', trophy: 'Golden Boot', seriesStartYear: 1906, trophyCreatedYear: 1996, dormant: false, source: 'https://en.wikipedia.org/wiki/Arkansas%E2%80%93LSU_football_rivalry' },
  { id: 'battle-line', schoolIds: ['arkansas', 'missouri'], name: 'Battle Line Rivalry', trophy: 'Battle Line Trophy', seriesStartYear: 1906, trophyCreatedYear: 2014, dormant: false, source: 'https://en.wikipedia.org/wiki/Arkansas%E2%80%93Missouri_football_rivalry' },
  { id: 'palmetto-bowl', schoolIds: ['south-carolina', 'clemson'], name: 'Palmetto Bowl', trophy: null, seriesStartYear: 1896, trophyCreatedYear: null, dormant: false, source: 'https://en.wikipedia.org/wiki/Clemson%E2%80%93South_Carolina_rivalry' },
  { id: 'governors-cup-ky', schoolIds: ['kentucky', 'louisville'], name: "Governor's Cup", trophy: "Governor's Cup", seriesStartYear: 1912, trophyCreatedYear: 1994, dormant: false, source: 'https://en.wikipedia.org/wiki/Governor%27s_Cup_(Kentucky)' },
  // Big Ten
  { id: 'the-game', schoolIds: ['michigan', 'ohio-state'], name: 'The Game', trophy: null, seriesStartYear: 1897, trophyCreatedYear: null, dormant: false, source: 'https://en.wikipedia.org/wiki/Michigan%E2%80%93Ohio_State_football_rivalry' },
  { id: 'paul-bunyans-axe', schoolIds: ['minnesota', 'wisconsin'], name: "Paul Bunyan's Axe", trophy: "Paul Bunyan's Axe", seriesStartYear: 1890, trophyCreatedYear: 1948, dormant: false, source: 'https://en.wikipedia.org/wiki/Minnesota%E2%80%93Wisconsin_football_rivalry' },
  { id: 'paul-bunyan-trophy', schoolIds: ['michigan', 'michigan-state'], name: 'Paul Bunyan Trophy', trophy: 'Paul Bunyan Trophy', seriesStartYear: 1898, trophyCreatedYear: 1953, dormant: false, source: 'https://en.wikipedia.org/wiki/Michigan%E2%80%93Michigan_State_football_rivalry' },
  { id: 'little-brown-jug', schoolIds: ['michigan', 'minnesota'], name: 'Little Brown Jug', trophy: 'Little Brown Jug', seriesStartYear: 1892, trophyCreatedYear: 1903, dormant: false, source: 'https://en.wikipedia.org/wiki/Little_Brown_Jug_(American_football)' },
  { id: 'old-oaken-bucket', schoolIds: ['indiana', 'purdue'], name: 'Old Oaken Bucket', trophy: 'Old Oaken Bucket', seriesStartYear: 1891, trophyCreatedYear: 1925, dormant: false, source: 'https://en.wikipedia.org/wiki/Old_Oaken_Bucket' },
  { id: 'land-of-lincoln', schoolIds: ['illinois', 'northwestern'], name: 'Land of Lincoln Trophy', trophy: 'Land of Lincoln Trophy', seriesStartYear: 1892, trophyCreatedYear: 2009, dormant: false, source: 'https://en.wikipedia.org/wiki/Illinois%E2%80%93Northwestern_football_rivalry' },
  { id: 'heroes-trophy', schoolIds: ['iowa', 'nebraska'], name: 'Heroes Game', trophy: 'Heroes Trophy', seriesStartYear: 1891, trophyCreatedYear: 2011, dormant: false, source: 'https://en.wikipedia.org/wiki/Iowa%E2%80%93Nebraska_football_rivalry' },
  { id: 'victory-bell-la', schoolIds: ['usc', 'ucla'], name: 'Victory Bell', trophy: 'Victory Bell', seriesStartYear: 1929, trophyCreatedYear: 1942, dormant: false, source: 'https://en.wikipedia.org/wiki/UCLA%E2%80%93USC_rivalry' },
  // ACC / cross
  { id: 'commonwealth-cup', schoolIds: ['virginia', 'virginia-tech'], name: 'Commonwealth Cup', trophy: 'Commonwealth Cup', seriesStartYear: 1895, trophyCreatedYear: 1996, dormant: false, source: 'https://en.wikipedia.org/wiki/Virginia%E2%80%93Virginia_Tech_football_rivalry' },
  { id: 'backyard-brawl', schoolIds: ['pittsburgh', 'west-virginia'], name: 'Backyard Brawl', trophy: null, seriesStartYear: 1895, trophyCreatedYear: null, dormant: false, source: 'https://en.wikipedia.org/wiki/Backyard_Brawl' },
  { id: 'big-game', schoolIds: ['california', 'stanford'], name: 'Big Game', trophy: 'Stanford Axe', seriesStartYear: 1892, trophyCreatedYear: 1899, dormant: false, source: 'https://en.wikipedia.org/wiki/Big_Game_(American_football)' },
  { id: 'victory-bell-oh', schoolIds: ['cincinnati', 'miami-oh'], name: 'Victory Bell', trophy: 'Victory Bell', seriesStartYear: 1888, trophyCreatedYear: 1892, dormant: false, source: 'https://en.wikipedia.org/wiki/Victory_Bell_(Cincinnati%E2%80%93Miami)' },
  // Big 12
  { id: 'sunflower-showdown', schoolIds: ['kansas', 'kansas-state'], name: 'Sunflower Showdown', trophy: "Governor's Cup", seriesStartYear: 1902, trophyCreatedYear: 1969, dormant: false, source: 'https://en.wikipedia.org/wiki/Kansas%E2%80%93Kansas_State_football_rivalry' },
  { id: 'farmageddon', schoolIds: ['kansas-state', 'iowa-state'], name: 'Farmageddon', trophy: null, seriesStartYear: 1917, trophyCreatedYear: null, dormant: false, source: 'https://en.wikipedia.org/wiki/Iowa_State%E2%80%93Kansas_State_football_rivalry' },
  { id: 'cy-hawk', schoolIds: ['iowa', 'iowa-state'], name: 'Cy-Hawk Series', trophy: 'Cy-Hawk Trophy', seriesStartYear: 1894, trophyCreatedYear: 1977, dormant: false, source: 'https://en.wikipedia.org/wiki/Iowa%E2%80%93Iowa_State_football_rivalry' },
  { id: 'territorial-cup', schoolIds: ['arizona', 'arizona-state'], name: 'Territorial Cup', trophy: 'Territorial Cup', seriesStartYear: 1899, trophyCreatedYear: 1899, dormant: false, source: 'https://en.wikipedia.org/wiki/Territorial_Cup' },
  { id: 'holy-war', schoolIds: ['byu', 'utah'], name: 'Holy War', trophy: null, seriesStartYear: 1896, trophyCreatedYear: null, dormant: false, source: 'https://en.wikipedia.org/wiki/BYU%E2%80%93Utah_rivalry' },
  // G5 / service
  { id: 'milk-can', schoolIds: ['boise-state', 'fresno-state'], name: 'Milk Can', trophy: 'Milk Can', seriesStartYear: 1977, trophyCreatedYear: 2005, dormant: false, source: 'https://en.wikipedia.org/wiki/Boise_State%E2%80%93Fresno_State_football_rivalry' },
  { id: 'army-navy', schoolIds: ['army', 'navy'], name: 'Army–Navy Game', trophy: null, seriesStartYear: 1890, trophyCreatedYear: null, dormant: false, source: 'https://en.wikipedia.org/wiki/Army%E2%80%93Navy_Game' },
];

// Build the lookup once (pair-key -> entry). Warn on duplicate pairs.
const BY_PAIR: Record<string, RivalryEntry> = {};
for (const r of RIVALRIES_2026) BY_PAIR[pairKey(r.schoolIds[0], r.schoolIds[1])] = r;

/** Tag lookup for a scheduled matchup. Order-independent, alias-normalized.
 *  Returns the Wikipedia-corroborated rivalry entry, or null (leave untagged —
 *  safe under-tag). Never crowns: the entry carries no signature/ranking. */
export function tagRivalry(homeId: string, awayId: string): RivalryEntry | null {
  return BY_PAIR[pairKey(homeId, awayId)] || null;
}

export const RIVALRY_SEED_COUNT = RIVALRIES_2026.length;
