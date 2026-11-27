// Shared fixtures for the MiLB gate tests (milb-gate-*.test.ts). Not a test
// file itself. A fake Firestore laid out as production is (MiLB G2b): pro clubs
// in `teams` with `promos`, MILB clubs in `milbTeams` with `milbPromos`
// (src/lib/team-paths.ts), and stubs for the sitemap's sources that have
// nothing to do with teams. Every read of a MILB path is counted.
//
//   teams/minnesota-twins (MLB)             4 promos
//   teams/toronto-maple-leafs (NHL)         3 promos
//   milbTeams/durham-bulls (MILB, AAA)      2 milbPromos, one upcoming (2027-05-21)
//   milbTeams/st-paul-saints (MILB, AAA)    1 milbPromo, played (2026-04-01)
// With `rogue: true`, docs in the WRONG home, which nothing may serve:
//   teams/rogue-in-teams (league MILB), milbTeams/rogue-in-milb (league MLB),
//   teams/durham-bulls/promos/rogue (a MILB club's doc in a `promos` collection)
type Data = Record<string, unknown>;

const promo = (date: string, title: string): Data => ({ date, title, type: 'theme', description: '', icon: '', time: '', opponent: '' });

function buildDocs(rogue: boolean): Map<string, Data> {
  const m = new Map<string, Data>([
    ['teams/minnesota-twins', { league: 'MLB', city: 'Minnesota', name: 'Twins', abbreviation: 'MIN', primaryColor: 0xff002b5c, secondaryColor: 0xffd31145 }],
    ['teams/toronto-maple-leafs', { league: 'NHL', city: 'Toronto', name: 'Maple Leafs', abbreviation: 'TOR', primaryColor: 0xff00205b, secondaryColor: 0xffffffff }],
    ['milbTeams/durham-bulls', { league: 'MILB', city: 'Durham', name: 'Bulls', abbreviation: 'DUR', division: 'International League East', level: 'AAA', parentTeamId: 'tampa-bay-rays', apiId: 234, primaryColor: 0xff1f2937, secondaryColor: 0xffffffff, colorsPlaceholder: true }],
    ['milbTeams/st-paul-saints', { league: 'MILB', city: 'St. Paul', name: 'Saints', abbreviation: 'STP', division: 'International League West', level: 'AAA', parentTeamId: 'minnesota-twins', apiId: 1960, primaryColor: 0xff1f2937, secondaryColor: 0xffffffff, colorsPlaceholder: true }],
    ['teams/minnesota-twins/promos/t1', promo('2026-06-01', 'A')],
    ['teams/minnesota-twins/promos/t2', promo('2026-06-02', 'B')],
    ['teams/minnesota-twins/promos/t3', promo('2026-06-03', 'C')],
    ['teams/minnesota-twins/promos/t4', promo('2027-06-04', 'D')],
    ['teams/toronto-maple-leafs/promos/l1', promo('2026-12-01', 'E')],
    ['teams/toronto-maple-leafs/promos/l2', promo('2026-12-02', 'F')],
    ['teams/toronto-maple-leafs/promos/l3', promo('2026-12-03', 'G')],
    ['milbTeams/durham-bulls/milbPromos/d1', promo('2026-04-01', 'Opening Night')],
    ['milbTeams/durham-bulls/milbPromos/d2', promo('2027-05-21', 'Mountain Gnomes')],
    ['milbTeams/st-paul-saints/milbPromos/s1', promo('2026-04-01', 'Fireworks')],
  ]);
  if (rogue) {
    m.set('teams/rogue-in-teams', { league: 'MILB', city: 'Rogue', name: 'One' });
    m.set('milbTeams/rogue-in-milb', { league: 'MLB', city: 'Rogue', name: 'Two' });
    m.set('teams/durham-bulls/promos/rogue', promo('2027-05-22', 'Rogue row in a promos collection'));
  }
  return m;
}

const segs = (p: string) => p.split('/');
const isMilbPath = (p: string) => p.startsWith('milbTeams');

/** milbDoc: undefined = no appConfig/milb doc; an object = its data; an Error = the read throws. */
export function makeFakeDb({ milbDoc, rogue = false }: { milbDoc: Data | Error | undefined; rogue?: boolean }) {
  const docs = buildDocs(rogue);
  const reads = { milbTeams: 0, milbPromos: 0 };
  const note = (path: string) => {
    if (!isMilbPath(path)) return;
    if (path.includes('milbPromos')) reads.milbPromos += 1;
    else reads.milbTeams += 1;
  };
  const docSnap = (path: string) => {
    const s = segs(path);
    const d = docs.get(path);
    return {
      id: s[s.length - 1],
      exists: d !== undefined,
      data: () => d,
      get: (f: string) => d?.[f],
      ref: { id: s[s.length - 1], path, parent: { id: s[s.length - 2], parent: s.length >= 4 ? { id: s[s.length - 3], parent: { id: s[s.length - 4] } } : null } },
    };
  };
  const querySnap = (paths: string[]) => {
    const list = paths.map(docSnap);
    return { empty: list.length === 0, size: list.length, docs: list };
  };
  type Filter = [string, string, unknown];
  const passes = (d: Data, f: Filter[]) =>
    f.every(([field, op, v]) => {
      const x = d[field] as string;
      if (op === '==') return x === v;
      if (op === '>=') return x >= (v as string);
      if (op === '<=') return x <= (v as string);
      if (op === '<') return x < (v as string);
      if (op === 'in') return (v as unknown[]).includes(x);
      throw new Error('fake where op ' + op);
    });
  const query = (label: string, select: () => string[], filters: Filter[] = [], ordered = false): any => ({
    where: (f: string, op: string, v: unknown) => query(label, select, [...filters, [f, op, v]], ordered),
    orderBy: () => query(label, select, filters, true),
    limit: () => query(label, select, filters, ordered),
    get: async () => {
      note(label);
      let paths = select().filter((p) => passes(docs.get(p)!, filters));
      if (ordered) paths = paths.sort((a, b) => String(docs.get(a)!.date).localeCompare(String(docs.get(b)!.date)) || a.localeCompare(b));
      return querySnap(paths);
    },
    count: () => ({ get: async () => { note(label); return { data: () => ({ count: select().filter((p) => passes(docs.get(p)!, filters)).length }) }; } }),
  });
  const childrenOf = (colPath: string) => () => [...docs.keys()].filter((p) => p.startsWith(colPath + '/') && segs(p).length === segs(colPath).length + 1).sort();
  const colRef = (colPath: string): any => ({
    ...query(colPath, childrenOf(colPath)),
    doc: (id: string) => ({
      get: async () => { note(colPath + '/' + id); return docSnap(colPath + '/' + id); },
      collection: (c: string) => colRef(colPath + '/' + id + '/' + c),
    }),
  });
  const db = {
    collection(name: string): any {
      if (name === 'teams' || name === 'milbTeams') return colRef(name);
      if (name === 'tnTeamMap' || name === 'venues' || name === 'games') return query(name, () => []);
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
      if (name === 'hashes') return query('hashes', () => []);
      if (name === 'promos' || name === 'milbPromos') {
        // Real collection-group semantics: every doc whose parent collection has this name.
        return query(name === 'milbPromos' ? 'milbTeams/*/milbPromos' : 'promos', () => [...docs.keys()].filter((p) => { const s = segs(p); return s.length >= 2 && s[s.length - 2] === name; }).sort());
      }
      throw new Error(`unexpected collectionGroup ${name}`);
    },
  };
  return { db, reads };
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
