// Shared fixtures for the MiLB gate tests (milb-gate-*.test.ts). Not a test
// file itself. A fake Firestore holding two pro clubs and two MILB clubs, and
// stubs for the sitemap's sources that have nothing to do with teams.
//
//   minnesota-twins (MLB)        4 promos
//   toronto-maple-leafs (NHL)    3 promos
//   durham-bulls (MILB, AAA)     2 promos, one upcoming (2027-05-21)
//   st-paul-saints (MILB, AAA)   1 promo, played (2026-04-01): zero upcoming
type Data = Record<string, unknown>;

const TEAMS: [string, Data][] = [
  ['minnesota-twins', { league: 'MLB', city: 'Minnesota', name: 'Twins', abbreviation: 'MIN', primaryColor: 0xff002b5c, secondaryColor: 0xffd31145 }],
  ['toronto-maple-leafs', { league: 'NHL', city: 'Toronto', name: 'Maple Leafs', abbreviation: 'TOR', primaryColor: 0xff00205b, secondaryColor: 0xffffffff }],
  ['durham-bulls', { league: 'MILB', city: 'Durham', name: 'Bulls', abbreviation: 'DUR', division: 'International League East', level: 'AAA', parentTeamId: 'tampa-bay-rays', apiId: 234, primaryColor: 0xff1f2937, secondaryColor: 0xffffffff, colorsPlaceholder: true }],
  ['st-paul-saints', { league: 'MILB', city: 'St. Paul', name: 'Saints', abbreviation: 'STP', division: 'International League West', level: 'AAA', parentTeamId: 'minnesota-twins', apiId: 1960, primaryColor: 0xff1f2937, secondaryColor: 0xffffffff, colorsPlaceholder: true }],
];

const promo = (date: string, title: string): Data => ({ date, title, type: 'theme', description: '', icon: '', time: '', opponent: '' });
const PROMOS: Record<string, [string, Data][]> = {
  'minnesota-twins': [['t1', promo('2026-06-01', 'A')], ['t2', promo('2026-06-02', 'B')], ['t3', promo('2026-06-03', 'C')], ['t4', promo('2026-06-04', 'D')]],
  'toronto-maple-leafs': [['l1', promo('2026-12-01', 'E')], ['l2', promo('2026-12-02', 'F')], ['l3', promo('2026-12-03', 'G')]],
  'durham-bulls': [['d1', promo('2026-04-01', 'Opening Night')], ['d2', promo('2027-05-21', 'Mountain Gnomes')]],
  'st-paul-saints': [['s1', promo('2026-04-01', 'Fireworks')]],
};
const TOTAL_PROMOS = Object.values(PROMOS).reduce((n, l) => n + l.length, 0); // 10

const snap = (rows: [string, Data][]) => ({
  empty: rows.length === 0,
  size: rows.length,
  docs: rows.map(([id, d]) => ({ id, exists: true, data: () => d, get: (f: string) => d[f], ref: { id } })),
});
const count = (n: number) => ({ get: async () => ({ data: () => ({ count: n }) }) });

/** milbDoc: undefined = no appConfig/milb doc; an object = its data; an Error = the read throws. */
export function makeFakeDb({ milbDoc }: { milbDoc: Data | Error | undefined }) {
  let milbPromoReads = 0;
  let milbTeamDocReads = 0;
  const isMilb = (teamId: string) => TEAMS.find(([id]) => id === teamId)?.[1].league === 'MILB';
  const promosOf = (teamId: string) => {
    const read = async () => {
      if (isMilb(teamId)) milbPromoReads += 1;
      return snap(PROMOS[teamId] ?? []);
    };
    // where() chains (date range reads) count as reads of the club's promos.
    const query: any = { where: () => query, orderBy: () => query, get: read, count: () => count(0) };
    return { orderBy: () => ({ get: read }), count: () => count((PROMOS[teamId] ?? []).length), where: () => query };
  };
  const db = {
    collection(name: string): any {
      if (name === 'teams') {
        return {
          get: async () => snap(TEAMS),
          doc: (id: string) => ({
            get: async () => {
              if (isMilb(id)) milbTeamDocReads += 1;
              const row = TEAMS.find(([t]) => t === id);
              return row ? { exists: true, data: () => row[1] } : { exists: false, data: () => undefined };
            },
            collection: (c: string) => { if (c !== 'promos') throw new Error('unexpected ' + c); return promosOf(id); },
          }),
        };
      }
      if (name === 'venues' || name === 'games') {
        const q: any = { where: () => q, orderBy: () => q, limit: () => q, get: async () => snap([]) };
        return q;
      }
      if (name === 'tnTeamMap') return { where: () => ({ get: async () => snap([]) }) };
      if (name === 'appConfig') {
        return {
          doc: (id: string) => ({
            get: async () => {
              if (id !== 'milb') return { exists: false, data: () => undefined };
              if (milbDoc instanceof Error) throw milbDoc;
              return milbDoc === undefined ? { exists: false, data: () => undefined } : { exists: true, data: () => milbDoc };
            },
          }),
        };
      }
      throw new Error(`unexpected collection ${name}`);
    },
    collectionGroup(name: string): any {
      if (name === 'hashes') return { get: async () => snap([]) };
      if (name === 'promos') return { count: () => count(TOTAL_PROMOS) };
      throw new Error(`unexpected collectionGroup ${name}`);
    },
  };
  return { db, milbPromoReads: () => milbPromoReads, milbTeamDocReads: () => milbTeamDocReads };
}

/** Stub every sitemap source that is not about teams, by resolved file URL. */
export function stubSitemapSources(mock: { module: (s: string, o: { namedExports: Record<string, unknown> }) => unknown }, base: string) {
  const at = (rel: string) => new URL(rel, base).href;
  mock.module(at('../postseason/data.ts'), { namedExports: { getPlayoffsSitemapEntries: async () => [] } });
  mock.module(at('../cfb/data.ts'), { namedExports: { getIndexableCfbSchoolIds: async () => [] } });
  mock.module(at('../cfb/matchups.ts'), { namedExports: { getAllMatchupSlugs: () => [] } });
  mock.module(at('../venue-hub.ts'), { namedExports: { getIndexableVenueHubSitemapEntries: async () => [] } });
  mock.module(at('../promo-pages.ts'), { namedExports: { getPromoPageSitemapEntries: async () => [], getPastPromoSitemap: async () => ({ archives: [] }) } });
  mock.module(at('../events/event-stops.ts'), { namedExports: { getEventSitemapEntries: async () => [] } });
  mock.module(at('../events/event-pages.ts'), { namedExports: { isEventsPagesLive: () => false } });
}
