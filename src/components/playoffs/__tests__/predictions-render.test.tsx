// The PromoNight Predicts bracket on a league page, in the server HTML, in every state
// the fixtures hold: the live WNBA bracket with the Lynx out, MLB mid Wild
// Card, and both brackets decided to the end. Built through the real mappers,
// the real view, the real assembly and the real components.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { homeGamesWindow } from '../../../lib/postseason/view';
import { FIXTURE, LYNX_OUT_AT, PREDICTED, buildWithPredictions, decidedMlb, decidedWnba, rawText, seriesKeyIn, type Built } from '../../../lib/postseason/__tests__/helpers';
import { PlayoffsLeague, type LeagueBody } from '../PlayoffsLeague';
import { PredictionsMethodology } from '../Predictions';
import { PredictionsCard } from '../PredictionsCard';
import { PredictedBracket } from '../PredictedBracket';
import { BracketControlsProvider } from '../controls';

const DECIDED_AT = new Date('2026-11-05T12:00:00Z');

const STATES: [string, () => Built, Date][] = [
  ['WNBA, Lynx out', () => buildWithPredictions(FIXTURE.wnbaLynxOut, PREDICTED.wnba, LYNX_OUT_AT), LYNX_OUT_AT],
  ['MLB, mid Wild Card', () => buildWithPredictions(FIXTURE.mlbWildCard, PREDICTED.mlb, LYNX_OUT_AT), LYNX_OUT_AT],
  ['WNBA, decided', () => buildWithPredictions(decidedWnba(), PREDICTED.wnba, DECIDED_AT), DECIDED_AT],
  ['MLB, decided', () => buildWithPredictions(decidedMlb(), PREDICTED.mlb, DECIDED_AT), DECIDED_AT],
];

function page(b: Built, now: Date): ReactElement {
  const v = b.view;
  const homeGames = v.phase.kind === 'active' ? homeGamesWindow([v], now) : { primary: [], rest: [] };
  const body: LeagueBody = { state: 'ok', view: v, predictions: b.predictions, homeGames };
  return <PlayoffsLeague league={v.league} season={v.season} body={body} tickets={{}} panelTickets={{}} otherLeagues={[]} />;
}
const html = (b: Built, now: Date) => renderToStaticMarkup(page(b, now));
const count = (h: string, needle: string) => h.split(needle).length - 1;

function element(h: string, marker: string): string {
  const at = h.indexOf(marker);
  assert.ok(at >= 0, `${marker} is in the markup`);
  const open = h.lastIndexOf('<', at);
  const tag = /^<([a-z0-9]+)/.exec(h.slice(open))?.[1] as string;
  const re = new RegExp(`<${tag}\\b[^>]*>|</${tag}>`, 'g');
  re.lastIndex = open;
  let depth = 0;
  for (let m = re.exec(h); m; m = re.exec(h)) {
    if (m[0].startsWith('</')) depth -= 1;
    else if (!m[0].endsWith('/>')) depth += 1;
    if (depth === 0) return h.slice(open, m.index + m[0].length);
  }
  assert.fail(`${marker} never closes`);
}
function textOf(h: string): string {
  return h
    .replace(/<(style|script|noscript)\b[\s\S]*?<\/\1>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
const pick = (h: string, seriesId: string) => element(h, `data-pick="${seriesId}"`);

function articleChildren(h: string): string[] {
  const article = element(h, 'data-playoffs-article=');
  const inner = article.slice(article.indexOf('>') + 1, article.lastIndexOf('</article>'));
  const out: string[] = [];
  const re = /<([a-z0-9]+)\b([^>]*)>|<\/([a-z0-9]+)>/g;
  const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
  let depth = 0;
  for (let m = re.exec(inner); m; m = re.exec(inner)) {
    if (m[3]) {
      depth -= 1;
      continue;
    }
    if (depth === 0) {
      const mark = /data-(page-intro|bracket-child|home-games|predictions-methodology|predictions|series-results)\b/.exec(m[2]);
      out.push(mark ? `${m[1]}[${mark[1]}]` : m[1]);
    }
    if (!(m[2].endsWith('/') || VOID.has(m[1]))) depth += 1;
  }
  return out;
}

// ---- Placement: what the ad placer reads ----

for (const [name, make, now] of STATES) {
  test(`PLACEMENT (${name}): the predictions are a child of the article after the bracket, the methodology near its foot, no ad inside either bracket`, () => {
    const b = make();
    const h = html(b, now);
    const kids = articleChildren(h);
    assert.deepEqual(kids.slice(0, 4), ['header', 'div[page-intro]', 'div[bracket-child]', 'section[predictions]'], kids.join(' '));
    assert.equal(kids[kids.length - 1], 'section[predictions-methodology]', kids.join(' '));
    assert.ok(kids.indexOf('section[series-results]') < kids.indexOf('section[predictions-methodology]'));
    // Neither bracket holds the other, and neither holds an ad container.
    const real = element(h, 'data-bracket-child');
    const predicted = element(h, 'data-predictions="bracket"');
    assert.ok(!real.includes('data-predicted-bracket'));
    assert.ok(!predicted.includes('data-bracket-child'));
    for (const sub of [real, predicted, element(h, 'data-predictions-methodology')]) {
      assert.ok(!/data-ad-|adthrive|raptive|class="page-content"/i.test(sub));
    }
    assert.equal(count(h, '<aside'), 0);
    assert.equal(count(h, 'page-content'), 1);
    // Nothing that renders as an empty element.
    assert.ok(!/<(div|section|p|span|ul|li|dl|dd|td)[^>]*><\/\1>/.test(element(h, 'data-playoffs-article=').replace(/<span aria-hidden="true"[^>]*><\/span>/g, '')), name);
  });
}

// ---- The predicted bracket ----

test('PREDICTED BRACKET, WNBA with the Lynx out: every mark, as the scoring rule says', () => {
  const h = html(STATES[0][1](), LYNX_OUT_AT);
  const r1 = pick(h, 'first_round-1');
  assert.match(r1, /data-pick-outcome="busted" data-pick-decided="true" data-dimmed="false"/);
  assert.ok(textOf(r1).includes('Busted'));
  assert.match(r1, /data-pick-side="pick"[\s\S]*?line-through[\s\S]*?Lynx/, 'the busted pick is struck through');
  assert.ok(textOf(r1).includes('Result: New York Liberty won 2-0.'));
  assert.ok(textOf(r1).includes('Lynx in 2 · 78%'));
  const sfa = pick(h, 'semifinals-1');
  assert.match(sfa, /data-pick-outcome="busted" data-pick-decided="false" data-dimmed="true"/);
  assert.match(sfa, /<details[^>]*class="[^"]*opacity-55/);
  assert.ok(textOf(sfa).includes('Minnesota Lynx are out.'));
  assert.ok(textOf(sfa).includes('Result: Not decided yet.'));
  const fin = pick(h, 'finals-1');
  assert.match(fin, /data-pick-outcome="alive" data-pick-decided="false" data-dimmed="true"/);
  assert.ok(textOf(fin).includes('Alive'));
  assert.ok(textOf(fin).includes('Can no longer happen'));
  assert.ok(textOf(fin).includes('Valkyries in 6 · 59%'));
  for (const id of ['first_round-2', 'first_round-3', 'first_round-4', 'semifinals-2']) {
    assert.match(pick(h, id), /data-pick-outcome="alive" data-pick-decided="false" data-dimmed="false"/, id);
    assert.doesNotMatch(pick(h, id), /opacity-55/, id);
  }
  const card = element(h, 'data-predictions-scorecard');
  assert.ok(textOf(card).includes('PromoNight Predicts is 0 for 1'));
  assert.ok(textOf(card).includes('5 picks still alive'));
  assert.ok(textOf(card).includes("Predicted champion Golden State Valkyries, still alive"));
});

test('PREDICTED BRACKET, MLB mid Wild Card: the coin flip reads as one; nothing decided', () => {
  const h = html(STATES[1][1](), LYNX_OUT_AT);
  const flip = pick(h, 'wild_card-1');
  assert.ok(textOf(flip).includes('Astros in 2 · Coin flip'));
  assert.ok(textOf(flip).includes("PromoNight's pick: Houston Astros in 2, a coin flip at lock."));
  assert.ok(!/50%/.test(textOf(flip)));
  assert.equal(count(h, 'data-pick-outcome="alive"'), 11);
  assert.equal(count(h, 'data-dimmed="true"'), 0);
  assert.ok(textOf(element(h, 'data-predictions-scorecard')).includes('No series decided yet'));
  assert.ok(textOf(element(h, 'data-predictions-scorecard')).includes('11 picks still alive'));
});

test('PREDICTED BRACKET, concluded: the final scorecard, nothing alive, the champion pick resolved', () => {
  const w = html(STATES[2][1](), DECIDED_AT);
  assert.ok(w.includes('data-champion="golden-state-valkyries"'), 'the real page is in its concluded state');
  assert.ok(textOf(element(w, 'data-predictions-scorecard')).includes('PromoNight Predicts is 4 for 7'));
  assert.ok(textOf(element(w, 'data-predictions-scorecard')).includes('0 picks still alive'));
  assert.match(w, /data-champion-pick="won"/);
  assert.equal(count(w, 'data-pick-outcome="alive"'), 0);
  assert.ok(textOf(pick(w, 'finals-1')).includes('This matchup did not happen.'));
  const m = html(STATES[3][1](), DECIDED_AT);
  assert.ok(textOf(element(m, 'data-predictions-scorecard')).includes('PromoNight Predicts is 5 for 11'));
  assert.match(m, /data-champion-pick="out"/);
  assert.ok(textOf(element(m, 'data-predictions-scorecard')).includes('Milwaukee Brewers, eliminated'));
});

test('PREDICTED BRACKET: its own pills and toggle, the same rounds as the real one, and the no-script rule', () => {
  const h = html(STATES[1][1](), LYNX_OUT_AT);
  const predicted = element(h, 'data-predicted-bracket=');
  const real = element(h, 'data-bracket="MLB"');
  const pills = (x: string) => [...x.matchAll(/data-round-option="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(pills(predicted), pills(real));
  assert.deepEqual(pills(predicted), ['wild_card', 'division_series', 'championship_series', 'world_series']);
  assert.equal(count(predicted, 'data-control="conference"'), 1);
  assert.match(predicted, /data-predicted-bracket="MLB" data-round="wild_card" data-conference="AL"/);
  assert.match(predicted, /<noscript><style>\.po-picks \[data-conf\]\[data-shown='false'\]\{display:revert!important\}\.po-picks \.po-controls\{display:none!important\}<\/style><\/noscript>/);
  // Every pick is in the server HTML, in a <details> that opens with no script.
  assert.equal(count(predicted, '<details'), 11);
  assert.equal(count(predicted, '<summary'), 11);
  // The scrollers are the containing block for their screen-reader text.
  const scrollers = [...predicted.matchAll(/<[a-z]+[^>]*class="([^"]*\boverflow-x-auto\b[^"]*)"[^>]*>/g)];
  assert.equal(scrollers.length, 2);
  for (const m of scrollers) assert.match(m[1], /(^| )relative( |$)/);
});

test('TITLE ODDS: eight rows, labeled at lock', () => {
  const h = html(STATES[0][1](), LYNX_OUT_AT);
  const t = element(h, 'data-title-odds');
  assert.ok(textOf(t).startsWith('Title odds at lock'));
  assert.equal(count(t, '<tr'), 9, 'a header row and eight teams');
  assert.ok(textOf(t).includes('Golden State Valkyries 37%'));
});

// ---- The contract: keys and fingerprints ----

const stored = (name: string) => JSON.parse(rawText(name)) as Record<string, Record<string, unknown>>;
function fingerprints(name: string): string[] {
  const d = stored(name);
  const p = d.provenance;
  return [p.corpusSha256, p.paramsSha256, p.descriptorSha256, p.slugMapSha256, d.reviewedSha256 as unknown as string] as string[];
}

for (const [name, make, now] of STATES) {
  test(`CONTRACT (${name}): no series key; the five fingerprints only in the methodology, each once; no other hash`, () => {
    const b = make();
    const h = html(b, now);
    const fixture = b.predicted.league === 'MLB' ? PREDICTED.mlb : PREDICTED.wnba;
    assert.equal(seriesKeyIn(h), null);
    assert.ok(!/(data-[a-z-]+|id)="(WS|F)"/.test(h) && !/#(WS|F)"/.test(h));
    const method = element(h, 'data-predictions-methodology');
    for (const f of fingerprints(fixture)) {
      assert.equal(count(h, f), 1, f);
      assert.equal(count(method, f), 1, f);
    }
    assert.ok(!/[0-9a-f]{40,}/.test(h.replace(method, '')));
    const p = stored(fixture).provenance;
    for (const v of [p.seedFileSha256, p.canonicalDescriptorSha256, p.seedFileAuthoredBy, p.frozenBy, p.engineCommitAtFreeze]) {
      assert.ok(typeof v === 'string' && !h.includes(v), String(v));
    }
    assert.ok(!/publish soon/i.test(h));
    assert.ok(!/—/.test(h), 'no em dash');
  });
}

// ---- No client component receives a hash as a prop ----
//
// Every component in a 'use client' file of the playoffs and analytics
// components is collected. The page's element tree is then expanded, server
// components run, client components NOT run, and every prop a client
// component receives, its children included, is searched for anything with
// the shape of a hash.

/** Every export of every 'use client' module under src/components, src/app
 *  and src/hooks (tests excluded): every directory that holds one today. */
async function clientComponents(): Promise<Set<unknown>> {
  const out = new Set<unknown>();
  const roots = [new URL('../../', import.meta.url), new URL('../../../app/', import.meta.url), new URL('../../../hooks/', import.meta.url)];
  const files: URL[] = [];
  const walk = (dir: URL) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (e.name !== '__tests__' && e.name !== 'node_modules') walk(new URL(`${e.name}/`, dir));
      } else if (/\.tsx?$/.test(e.name)) files.push(new URL(e.name, dir));
    }
  };
  for (const r of roots) walk(r);
  for (const url of files) {
    if (!/^\s*['"]use client['"]/.test(readFileSync(url, 'utf-8'))) continue;
    const mod = (await import(url.href)) as Record<string, unknown>;
    for (const v of Object.values(mod)) if (typeof v === 'function' || (v && typeof v === 'object')) out.add(v);
  }
  return out;
}

/** A component type, through memo() and forwardRef() wrappers. */
function innerType(t: unknown): unknown {
  let x = t as { type?: unknown; render?: unknown } | null;
  for (let i = 0; i < 4 && x && typeof x === 'object'; i++) {
    if (x.type) x = x.type as typeof x;
    else if (x.render) x = x.render as typeof x;
    else break;
  }
  return x;
}

// What no client prop may carry, besides a hash: a series key (by shape,
// and the short ones by exact value), and every operator value, path, blob
// and commit of the two stored predicted documents.
const SHORT_KEYS = new Set(['WS', 'F']);
const BANNED_VALUES = (() => {
  const out = new Set<string>();
  for (const name of [PREDICTED.wnba, PREDICTED.mlb]) {
    const d = JSON.parse(rawText(name)) as Record<string, Record<string, unknown>>;
    const p = d.provenance;
    for (const v of [d.computedBy, d.engineCommitAtExecute, p.frozenBy, p.seedFileAuthoredBy, p.seedFileSourceUrl, p.seedFile, p.descriptor, p.canonicalDescriptor, p.engineCommitAtFreeze, p.engineCommitAtCompute])
      if (typeof v === 'string') out.add(v);
    for (const f of [...(p.coreFiles as Record<string, string>[]), ...(p.engineFiles as Record<string, string>[])]) for (const v of Object.values(f)) if (typeof v === 'string') out.add(v);
  }
  return out;
})();

function findHash(v: unknown, seen = new Set<unknown>()): string | null {
  if (typeof v === 'string') {
    const hex = /[0-9a-f]{40,}/.exec(v)?.[0];
    if (hex) return hex;
    const key = seriesKeyIn(v);
    if (key) return `series key ${key}`;
    if (SHORT_KEYS.has(v)) return `series key ${v}`;
    for (const b of BANNED_VALUES) if (v.includes(b)) return `banned value ${b}`;
    return null;
  }
  if (!v || typeof v !== 'object' || seen.has(v)) return null;
  seen.add(v);
  if (isValidElement(v)) return findHash((v as ReactElement<Record<string, unknown>>).props, seen);
  for (const x of Array.isArray(v) ? v : Object.values(v)) {
    const hit = findHash(x, seen);
    if (hit) return hit;
  }
  return null;
}

// A client component's own props (everything but `children`) are its data:
// a hash there is served in the RSC payload, rendered or not. Its `children`
// are server output passed through it, so the walk continues into them, and
// a client component reached inside them is checked the same way. The
// methodology section, the one place a fingerprint may be, must never be
// under a client component at all.
function visit(node: ReactNode, client: Set<unknown>, hits: string[], path: string, inClient = false): void {
  if (Array.isArray(node)) {
    for (const n of node) visit(n, client, hits, path, inClient);
    return;
  }
  if (!isValidElement(node)) return;
  const el = node as ReactElement<Record<string, unknown>>;
  const { type, props } = el;
  const isClient = client.has(type) || client.has(innerType(type));
  if (typeof type === 'function' || isClient) {
    const name = (innerType(type) as { name?: string } | null)?.name ?? 'anonymous';
    if (type === PredictionsMethodology && inClient) hits.push(`${path} > ${name} is under a client component`);
    if (isClient) {
      const { children, ...own } = props;
      const hit = findHash(own);
      if (hit) hits.push(`${path} > ${name} receives ${hit.slice(0, 40)}`);
      visit(children as ReactNode, client, hits, `${path} > ${name}`, true);
      return;
    }
    visit((type as (p: unknown) => ReactNode)(props), client, hits, `${path} > ${name}`, inClient);
    return;
  }
  // A server component wrapped in memo() or forwardRef() is an object: run
  // the function inside it, so what it renders is walked too.
  const inner = innerType(type);
  if (typeof inner === 'function') {
    visit((inner as (p: unknown) => ReactNode)(props), client, hits, `${path} > ${(inner as { name?: string }).name ?? 'anonymous'}`, inClient);
    return;
  }
  visit(props.children as ReactNode, client, hits, `${path} > ${String(type)}`, inClient);
}

test('NO CLIENT COMPONENT receives a fingerprint, at any depth, and the methodology is under none', async () => {
  const client = await clientComponents();
  assert.ok(client.size >= 4, 'the client components were found');
  assert.ok(client.has(PredictedBracket) && client.has(BracketControlsProvider));
  for (const [name, make, now] of STATES) {
    const b = make();
    const hits: string[] = [];
    visit(page(b, now), client, hits, name);
    assert.deepEqual(hits, [], hits.join('\n'));
  }
});

test('THE WALKER would see a leak: a hash handed to the predicted bracket through the predictions section, and the methodology moved under a client', async () => {
  const client = await clientComponents();
  const b = STATES[0][1]();
  const hash = b.predicted.fingerprints.corpus;
  // A hash in a pick reaches PredictedBracket as a prop, inside
  // PredictionsSection, inside BracketControlsProvider's children.
  const rounds = structuredClone(b.predictions.view.rounds);
  rounds[0].groups[0].series[0].pickName = hash;
  const leaky: Built = { ...b, predictions: { ...b.predictions, view: { ...b.predictions.view, rounds } } };
  const hits: string[] = [];
  visit(page(leaky, LYNX_OUT_AT), client, hits, 'leaky');
  assert.ok(hits.some((h) => h.includes('PredictedBracket receives')), hits.join('\n'));
  // The methodology under a client component.
  const moved: string[] = [];
  visit(
    <BracketControlsProvider initialRound="first_round" initialConference={null} index={[]}>
      <PredictionsMethodology view={b.predictions.methodology} />
    </BracketControlsProvider>,
    client,
    moved,
    'moved',
  );
  assert.ok(moved.some((h) => h.includes('is under a client component')), moved.join('\n'));
  // A real client export from a directory the walker did not always scan
  // (src/app/error.tsx), and memo() and forwardRef() objects exported from a
  // client module whose inner function is NOT exported (stood in for by
  // adding the objects alone to the client set).
  const { default: GlobalError } = await import('../../../app/error');
  assert.ok(client.has(GlobalError), 'src/app is scanned');
  const { memo, forwardRef } = await import('react');
  const hidden = function HiddenClient(p: { children?: ReactNode }) {
    return <div>{p.children}</div>;
  };
  const memoExport = memo(hidden);
  const refExport = forwardRef(function HiddenRef(p: { children?: ReactNode }) {
    return <div>{p.children}</div>;
  });
  const withObjects = new Set([...client, memoExport, refExport]);
  assert.ok(!withObjects.has(hidden), 'the inner function is not itself in the set');
  for (const [label, Wrapper, set] of [
    ['error.tsx', GlobalError, client],
    ['memo export', memoExport, withObjects],
    ['forwardRef export', refExport, withObjects],
  ] as const) {
    const w: string[] = [];
    const W = Wrapper as unknown as (p: Record<string, unknown>) => ReactElement;
    visit(<W error={new Error('x')} reset={() => {}}><PredictionsMethodology view={b.predictions.methodology} /></W>, set, w, label);
    assert.ok(w.some((h) => h.includes('is under a client component')), `${label}: ${w.join('\n')}`);
  }
  // memo() and forwardRef() around a client function that IS in the set:
  // only unwrapping (innerType) recognises these as client components.
  const unwrapped: [string, unknown][] = [
    ['memo(PredictedBracket)', memo(PredictedBracket)],
    ['forwardRef(PredictedBracket)', forwardRef(PredictedBracket as unknown as Parameters<typeof forwardRef>[0])],
  ];
  for (const [label, Wrapper] of unwrapped) {
    assert.ok(!client.has(Wrapper), `${label}: the wrapper object is not in the set`);
    const w: string[] = [];
    const W = Wrapper as unknown as (p: Record<string, unknown>) => ReactElement;
    visit(<W league="MLB" leagueSlug="mlb" season={2026} rounds={[]}><PredictionsMethodology view={b.predictions.methodology} /></W>, client, w, label);
    assert.ok(w.some((h) => h.includes('is under a client component')), `${label}: ${w.join('\n')}`);
  }
  // Not only hashes: a series key, a short key by value, an operator value
  // and a file path, each handed to the predicted bracket, are each seen.
  const banned = JSON.parse(rawText(PREDICTED.mlb)) as Record<string, Record<string, unknown>>;
  for (const value of ['AL-WC-A', 'WS', String(banned.computedBy), String(banned.provenance.seedFileAuthoredBy), 'predictions/elo.js']) {
    const r = structuredClone(b.predictions.view.rounds);
    r[0].groups[0].series[0].pickLabel = value;
    const leak: Built = { ...b, predictions: { ...b.predictions, view: { ...b.predictions.view, rounds: r } } };
    const h: string[] = [];
    visit(page(leak, LYNX_OUT_AT), client, h, value);
    assert.ok(h.some((x) => x.includes('PredictedBracket receives')), `${value}: ${h.join('\n')}`);
  }
  // A server component wrapped in memo() is expanded: a hash it hands to a
  // client component inside its own output is seen.
  const ServerWrap = memo(function ServerWrap() {
    return <PredictedBracket league="MLB" leagueSlug="mlb" season={2026} rounds={[]} {...{ leak: hash }} />;
  });
  const sw: string[] = [];
  visit(<ServerWrap />, client, sw, 'server memo');
  assert.ok(sw.some((h) => h.includes('PredictedBracket receives')), sw.join('\n'));
});

test('METHODOLOGY COPY: computed and locked on one day, or on two, said as such', () => {
  const b = STATES[1][1]();
  const one = textOf(renderToStaticMarkup(<PredictionsMethodology view={b.predictions.methodology} />));
  assert.ok(one.includes('The bracket was computed from those locked inputs and locked on September 30, 2026. The locked bracket is written once and never changed'), one);
  const two = textOf(renderToStaticMarkup(<PredictionsMethodology view={{ ...b.predictions.methodology, bracketLockedOn: 'October 1, 2026' }} />));
  assert.ok(two.includes('The bracket was computed from those locked inputs on September 30, 2026 and locked on October 1, 2026. The locked bracket is written once'), two);
  assert.ok(one.includes('in the simulated postseasons where that matchup came up'));
});

test('METHODOLOGY COPY: "before Game 1" only when the real bracket proves it', () => {
  const b = STATES[1][1]();
  const proven = textOf(renderToStaticMarkup(<PredictionsMethodology view={b.predictions.methodology} />));
  assert.ok(proven.includes('The inputs were locked on September 28, 2026, before Game 1.'), proven);
  const unproven = textOf(renderToStaticMarkup(<PredictionsMethodology view={{ ...b.predictions.methodology, lockedBeforeGame1: false }} />));
  assert.ok(unproven.includes('The inputs were locked on September 28, 2026.'), unproven);
  assert.ok(!/Game 1/.test(unproven), unproven);
});

// The picks were made once and locked; nothing about them refreshes. No
// wording in the section, the methodology or the hub card may say otherwise.
const FRESHNESS_WORDS = /\bhourly\b|\breal[- ]time\b|\blive\b|\bup to the minute\b|\bminute by minute\b|\bupdated (every|each|daily|nightly)\b|\bre-?(run|computed|calculated|simulated)\b|\b(daily|nightly|latest) (picks?|odds|update)\b/i;
for (const [name, make, now] of STATES) {
  test(`CLAIMS (${name}): no freshness wording in the predictions, the methodology or the hub card`, () => {
    const b = make();
    const h = html(b, now);
    const hubCard = renderToStaticMarkup(<PredictionsCard heading="Predictions are locked" headingId="predictions-locked" lines={[b.predictions.hub]} />);
    for (const t of [textOf(element(h, 'data-predictions="bracket"')), textOf(element(h, 'data-predictions-methodology')), textOf(hubCard)]) {
      assert.ok(t.length > 0);
      assert.ok(!FRESHNESS_WORDS.test(t), `found ${t.match(FRESHNESS_WORDS)?.[0]}`);
    }
  });
}

// predictions.ts holds the locked fingerprints and the core file paths. A
// client component that imported a value from it would ship them in client
// JavaScript; every client import of it must be type-only.
test('NO CLIENT COMPONENT imports a value from predictions.ts or predictions-lock.ts', () => {
  const offenders: string[] = [];
  const walk = (dir: URL) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (e.name !== 'node_modules') walk(new URL(`${e.name}/`, dir));
        continue;
      }
      if (!/\.tsx?$/.test(e.name)) continue;
      const url = new URL(e.name, dir);
      const src = readFileSync(url, 'utf-8');
      if (!/^\s*['"]use client['"]/.test(src)) continue;
      for (const m of src.matchAll(/^import\s+(type\s+)?[^;]*?from\s+['"]([^'"]+)['"]/gm)) {
        if (/postseason\/predictions(-lock)?$/.test(m[2]) && !m[1]) offenders.push(`${url.pathname}: ${m[0]}`);
      }
    }
  };
  walk(new URL('../../../', import.meta.url));
  assert.deepEqual(offenders, []);
});

test('THE METHODOLOGY COMPONENT is a server component, and so is the file that holds it', () => {
  const src = readFileSync(new URL('../Predictions.tsx', import.meta.url), 'utf-8');
  assert.ok(!/^\s*['"]use client['"]/.test(src));
  assert.ok(/^\s*['"]use client['"]/.test(readFileSync(new URL('../PredictedBracket.tsx', import.meta.url), 'utf-8')));
});
