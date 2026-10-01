// FAILURE ISOLATION, through the real routes. A predictions failure of any
// kind hides the predictions section and the hub's record line for that
// league, logs one tagged line per render, and costs the page nothing else:
// the real bracket renders, and goes on updating, exactly as it would with no
// predictions at all.
//
// A RENDER IS A REQUEST. Next runs generateMetadata and the page body of one
// request under one React cache() scope, so the page data is read once per
// render. Outside a request React's cache() does not memoize, so this file
// stands one in: `cache` is the real React module's export replaced by a
// memoizer whose scope is reset by render(). Removing a cache() wrapper from
// the data module makes the "once per render" tests fail, which is the point.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import * as ReactNs from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FIXTURE, PREDICTED, capturedTeams, fakeFirestore, loadDoc, parkNames, venuePages } from '../../../lib/postseason/__tests__/helpers';

let scope = new Map<unknown, Map<string, unknown>>();
function cache<A extends unknown[], R>(fn: (...a: A) => R): (...a: A) => R {
  return (...args: A) => {
    let m = scope.get(fn);
    if (!m) scope.set(fn, (m = new Map()));
    const k = JSON.stringify(args);
    if (!m.has(k)) m.set(k, fn(...args));
    return m.get(k) as R;
  };
}
mock.module('react', { namedExports: { ...ReactNs, cache }, defaultExport: (ReactNs as { default?: unknown }).default ?? ReactNs });

type Fake = ReturnType<typeof fakeFirestore>;
const current: { db: Fake } = { db: fakeFirestore({}) };
const db = {
  collection: (name: string) => current.db.collection(name),
  getAll: (...args: unknown[]) => current.db.getAll(...args),
};
const teams: { failAfter: (() => boolean) | null; dropOn: (() => string | null) | null } = { failAfter: null, dropOn: null };
mock.module('server-only', { namedExports: {} });
mock.module(new URL('../../../lib/firebase.ts', import.meta.url).href, { namedExports: { db } });
mock.module(new URL('../../../lib/data.ts', import.meta.url).href, {
  namedExports: {
    getAllTeams: async () => {
      if (teams.failAfter && teams.failAfter()) throw new Error('teams read failed');
      const gone = teams.dropOn ? teams.dropOn() : null;
      return capturedTeams().filter((t) => t.id !== gone);
    },
    getVenueForTeam: async (id: string) => {
      const name = parkNames().get(id);
      return name ? { name } : null;
    },
  },
});
mock.module(new URL('../../../lib/venue-hub.ts', import.meta.url).href, { namedExports: { getTeamVenueHubMap: async () => venuePages() } });
mock.module(new URL('../../../components/cfb/rivalry/fonts.ts', import.meta.url).href, { namedExports: { barlowCondensed: { variable: 'v1' } } });
mock.module(new URL('../../../components/redesign/fonts-house.ts', import.meta.url).href, { namedExports: { archivoHouse: { variable: 'v2' } } });

const league = () => import('../[league]/page');
const hub = () => import('../page');
const params = (slug: string) => ({ params: Promise.resolve({ league: slug }) });
const count = (h: string, n: string) => h.split(n).length - 1;

type Docs = Parameters<typeof fakeFirestore>[0];
const MLB = () => loadDoc(FIXTURE.mlbWildCard);
const WNBA = () => loadDoc(FIXTURE.wnbaLynxOut);
const P_MLB = () => loadDoc(PREDICTED.mlb);
const P_WNBA = () => loadDoc(PREDICTED.wnba);

/** Every predictions failure the ruling names, plus the two the assembly can
 *  meet. `docs` replaces the MLB prediction; `before` sets up anything else. */
const FAILURES: {
  name: string;
  reason: string;
  prediction: () => Record<string, unknown> | Error | undefined;
  bracket?: () => Record<string, unknown>;
  before?: () => void;
  after?: () => void;
  /** Runs on the league page only (the hub reads its leagues in parallel). */
  leagueOnly?: boolean;
  /** The read never settles. */
  hang?: boolean;
}[] = [
  { name: 'a failed Firestore read', reason: 'read-failed', prediction: () => new Error('PERMISSION_DENIED: predictedBrackets/MLB_2026') },
  { name: 'a missing document', reason: 'missing', prediction: () => undefined },
  { name: 'a document the mapper refuses', reason: 'refused', prediction: () => ({ ...P_MLB(), target: 'scratch' }) },
  {
    name: 'a fingerprint mismatch',
    reason: 'fingerprint-mismatch',
    prediction: () => {
      const d = P_MLB();
      (d.provenance as Record<string, unknown>).corpusSha256 = 'b'.repeat(64);
      return d;
    },
  },
  {
    name: 'right fingerprints and a different pick',
    reason: 'content-mismatch',
    prediction: () => {
      const d = P_MLB();
      (d.rounds as Record<string, unknown>[])[1].pickProbability = 0.5815;
      return d;
    },
  },
  {
    // The bracket, not the prediction, changes: a renamed key leaves a
    // locked pick with no real slot.
    name: 'a real bracket that no longer joins the lock',
    reason: 'no-join',
    prediction: () => P_MLB(),
    bracket: () => {
      const b = MLB();
      (b.series as Record<string, unknown>[]).find((x) => x.seriesKey === 'NL-WC-B')!.seriesKey = 'NL-WC-Z';
      return b;
    },
  },
  {
    name: 'a read that hangs',
    reason: 'read-failed',
    prediction: () => P_MLB(),
    hang: true,
    before: () => {
      process.env.PREDICTIONS_READ_TIMEOUT_MS = '40';
    },
    after: () => {
      delete process.env.PREDICTIONS_READ_TIMEOUT_MS;
    },
  },
  {
    name: 'PREDICTIONS_DISABLED',
    reason: 'disabled',
    prediction: () => P_MLB(),
    before: () => {
      process.env.PREDICTIONS_DISABLED = 'MLB';
    },
    after: () => {
      delete process.env.PREDICTIONS_DISABLED;
    },
  },
  {
    // The team list loses a club between the bracket's read and the
    // predictions' (the second of the page's three reads).
    name: 'a club the team list loses',
    reason: 'no-team-record',
    prediction: () => P_MLB(),
    leagueOnly: true,
    before: () => {
      let n = 0;
      teams.dropOn = () => (++n === 2 ? 'milwaukee-brewers' : null);
    },
    after: () => {
      teams.dropOn = null;
    },
  },
  {
    name: 'an exception while building',
    reason: 'build-failed',
    prediction: () => P_MLB(),
    // The league page reads the team list three times, in order: the real
    // bracket's view, the predictions' clubs, the ticket buttons. Only the
    // second fails. (Not run on the hub, whose two leagues read in parallel.)
    leagueOnly: true,
    before: () => {
      let n = 0;
      teams.failAfter = () => ++n === 2;
    },
  },
];

function docsWith(prediction: Record<string, unknown> | Error | undefined, bracket = MLB()): Docs {
  const d: Docs = { 'postseasonBrackets/MLB_2026': bracket, 'postseasonBrackets/WNBA_2026': WNBA(), 'predictedBrackets/WNBA_2026': P_WNBA() };
  if (prediction !== undefined) d['predictedBrackets/MLB_2026'] = prediction;
  return d;
}

/** One request: a fresh cache scope, the head, then the body, as Next runs
 *  them. Returns the markup, the head and every tagged log line. */
async function renderLeague(slug: string) {
  scope = new Map();
  const { default: Page, generateMetadata } = await league();
  const original = console.error;
  const lines: string[] = [];
  console.error = (...a: unknown[]) => {
    const l = a.map(String).join(' ');
    if (l.includes('[predictions-unavailable]')) lines.push(l);
  };
  try {
    const meta = (await generateMetadata(params(slug))) as { title?: string };
    const html = renderToStaticMarkup(await Page(params(slug)));
    return { html, meta, lines };
  } finally {
    console.error = original;
  }
}
async function renderHub() {
  scope = new Map();
  const { default: Page, generateMetadata } = await hub();
  const original = console.error;
  const lines: string[] = [];
  console.error = (...a: unknown[]) => {
    const l = a.map(String).join(' ');
    if (l.includes('[predictions-unavailable]')) lines.push(l);
  };
  try {
    await generateMetadata();
    return { html: renderToStaticMarkup(await Page()), lines };
  } finally {
    console.error = original;
  }
}

/** Make the MLB predictions read never settle on the current fake. */
function hangPredictions() {
  const fake = current.db;
  const real = fake.getAll.bind(fake);
  fake.getAll = (...args: unknown[]) => ((args[0] as { path: string }).path === 'predictedBrackets/MLB_2026' ? new Promise(() => {}) : real(...args)) as ReturnType<typeof real>;
}

/** Nothing of the predictions, and nothing about their failure, in a page. */
function assertNoPredictions(html: string, where: string) {
  for (const marker of ['id="predictions"', 'data-predictions', 'data-pick', 'po-picks', 'how-promonight-predicts-works', 'Title odds', "Computer&#x27;s", 'The Computer', 'Fingerprints']) {
    assert.equal(count(html, marker), 0, `${where}: ${marker}`);
  }
  assert.ok(!/[0-9a-f]{40,}/.test(html), `${where}: a hash`);
  assert.ok(!/unavailable|PERMISSION|predictedBrackets|error/i.test(html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '')), `${where}: failure text in the page`);
}

function stampOf(doc: Record<string, unknown>): string {
  return ((doc.lastChangedAt as { toDate: () => Date }).toDate()).toISOString();
}

// ---- (a) and (d): every failure kind ----

for (const f of FAILURES) {
  test(`(a)+(d) ${f.name}: the league page renders, the real bracket is current, no predictions, one tagged line`, async () => {
    teams.failAfter = null;
    f.before?.();
    try {
      const bracket = f.bracket ? f.bracket() : MLB();
      current.db = fakeFirestore(docsWith(f.prediction(), bracket));
      if (f.hang) hangPredictions();
      const { html, meta, lines } = await renderLeague('mlb');
      // It rendered: no throw, no notFound. The route's status is 200.
      assert.match(html, /<h1[^>]*>2026 MLB Playoffs<\/h1>/);
      assert.equal(count(html, 'data-series="'), 11, 'the whole real bracket');
      // Current: the page names the document's own change stamp.
      const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '{}') as { dateModified?: string };
      assert.equal(ld.dateModified, stampOf(bracket));
      assertNoPredictions(html, f.name);
      // The head does not promise predictions the body does not show.
      assert.equal(meta.title, '2026 MLB Playoffs Bracket, Schedule and Scores');
      // (d) Exactly one tagged line for the render: head and body share it.
      assert.deepEqual(lines, [`[predictions-unavailable] league=MLB reason=${f.reason}`]);
      // The other league's page is untouched by this one's failure.
      const w = await renderLeague('wnba');
      assert.equal(count(w.html, 'id="predictions"'), 1);
      assert.deepEqual(w.lines, []);
    } finally {
      teams.failAfter = null;
      f.after?.();
    }
  });
}

// ---- (b): the page is not frozen ----

test('(b) a broken prediction plus a real-bracket update: the next render serves the new real-bracket state', async () => {
  const broken = { ...P_MLB(), target: 'scratch' };
  const v1 = MLB();
  current.db = fakeFirestore(docsWith(broken, v1));
  const first = await renderLeague('mlb');
  assert.ok(first.html.includes('data-series="wild_card-2" data-series-status="live"'));

  // The pipeline writes the next version: AL-WC-B goes final, the Yankees
  // through, and the change stamp moves. Revalidation is a fresh render.
  const v2 = MLB();
  const s = (v2.series as Record<string, unknown>[]).find((x) => x.seriesKey === 'AL-WC-B') as Record<string, unknown>;
  s.status = 'final';
  s.winner = 'new-york-yankees';
  s.wins = { higher: 2, lower: 0 };
  const later = new Date(new Date(stampOf(v1)).getTime() + 3_600_000);
  v2.lastChangedAt = { toDate: () => later };
  current.db = fakeFirestore(docsWith(broken, v2));
  const second = await renderLeague('mlb');
  assert.ok(second.html.includes('data-series="wild_card-2" data-series-status="final"'), 'the new state is served');
  const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(second.html)?.[1] ?? '{}') as { dateModified?: string };
  assert.equal(ld.dateModified, later.toISOString());
  assert.ok(second.html.includes('NYY won 2-0'));
  assertNoPredictions(second.html, 'after the update');
  assert.equal(second.lines.length, 1);
});

// ---- (c): the hub ----

test('(c) the hub stays up; the broken league loses its record line, the other keeps it', async () => {
  for (const f of FAILURES.filter((x) => !x.leagueOnly)) {
    teams.failAfter = null;
    f.before?.();
    try {
      current.db = fakeFirestore(docsWith(f.prediction(), f.bracket ? f.bracket() : MLB()));
      if (f.hang) hangPredictions();
      const { html, lines } = await renderHub();
      assert.equal(count(html, 'data-league-card="'), 2, `${f.name}: both league cards`);
      assert.equal(count(html, 'data-predictions-league="mlb"'), 0, `${f.name}: no MLB line`);
      assert.equal(count(html, 'data-predictions-league="wnba"'), 1, `${f.name}: the WNBA line stays`);
      assert.ok(!/[0-9a-f]{40,}/.test(html));
      assert.ok(!/unavailable|PERMISSION|predictedBrackets/i.test(html), `${f.name}: failure text on the hub`);
      // (d) on the hub: one line for the one failed league, in one render.
      assert.deepEqual(lines, [`[predictions-unavailable] league=MLB reason=${f.reason}`], f.name);
    } finally {
      teams.failAfter = null;
      f.after?.();
    }
  }
  // Both broken: the card goes, with its heading. No empty shell.
  const docs = docsWith(undefined);
  delete docs['predictedBrackets/WNBA_2026'];
  current.db = fakeFirestore(docs);
  const { html, lines } = await renderHub();
  assert.equal(count(html, 'data-predictions'), 0);
  assert.ok(!html.includes('Predictions are locked'));
  assert.equal(count(html, 'data-league-card="'), 2);
  assert.equal(lines.length, 2);
});

test('(d) a healthy render logs nothing, and the tag is emitted once per failed render, never per read', async () => {
  current.db = fakeFirestore(docsWith(P_MLB()));
  assert.deepEqual((await renderLeague('mlb')).lines, []);
  current.db = fakeFirestore(docsWith(new Error('UNAVAILABLE')));
  // Three renders, three lines: one each.
  const all = [...(await renderLeague('mlb')).lines, ...(await renderLeague('mlb')).lines, ...(await renderLeague('mlb')).lines];
  assert.equal(all.length, 3);
});

// ---- The real bracket keeps throwing ----

test('THE REAL BRACKET STILL THROWS through the route, so ISR keeps the last good page', async () => {
  const { default: Page } = await league();
  scope = new Map();
  const docs = docsWith(P_MLB());
  docs['postseasonBrackets/MLB_2026'] = new Error('UNAVAILABLE: bracket read');
  current.db = fakeFirestore(docs);
  await assert.rejects(() => Page(params('mlb')), /UNAVAILABLE/);
});
