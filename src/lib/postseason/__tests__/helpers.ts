// Test helpers for the postseason module. Not a test file: the suite glob is
// *.test.ts and *.test.tsx.
import { readFileSync } from 'node:fs';
import type { Team } from '../../types';
import { mapBracketDoc } from '../map';
import { assemblePredictions, mapPredictedDoc, type LeaguePredictions, type PredictedBracket } from '../predictions';
import type { Bracket } from '../types';
import { buildLeagueView, seriesIds, type ClubInfo, type LeagueView, type ParkInfo } from '../view';

const FIXTURES = new URL('../__fixtures__/', import.meta.url);

export const FIXTURE = {
  mlbLive: 'MLB_2026.live-20260929T1715Z.json',
  wnbaLive: 'WNBA_2026.live-20260929T1715Z.json',
  mlbInGame: 'MLB_2026.live-ingame-20260929T1909Z.json',
  // Writer version 2: the documents carry shortLabel, feederSeriesKey and
  // candidates.
  mlbFields: 'MLB_2026.live-20260929T2008Z.json',
  wnbaFields: 'WNBA_2026.live-20260929T2008Z.json',
  mlbFinal: 'MLB_2025.final.json',
  wnbaFinal: 'WNBA_2025.final.json',
  mlbMixed: 'MLB_2025.replay-step-24.json',
  wnbaMixed: 'WNBA_2025.replay-step-10.json',
  // 2026-10-01T00:17Z: the Lynx out (lost 0-2 to the Liberty), the other
  // three WNBA first-round series live; all four MLB Wild Card series live.
  wnbaLynxOut: 'WNBA_2026.live-20261001T0017Z.json',
  mlbWildCard: 'MLB_2026.live-20261001T0017Z.json',
} as const;

/** The locked computer brackets, predictedBrackets/{LEAGUE}_2026, whole, as
 *  stored (read 2026-10-01T00:17Z). Not bracket documents, so not in FIXTURE,
 *  which tests walk as brackets. */
export const PREDICTED = {
  wnba: 'predicted.WNBA_2026.json',
  mlb: 'predicted.MLB_2026.json',
} as const;

/** The moment the 2026-10-01 documents were read. */
export const LYNX_OUT_AT = new Date('2026-10-01T00:17:37Z');

/** The moment the two live documents were read. Tests that need a "now" use
 *  this one, so nothing depends on the day the suite runs. */
export const CAPTURED_AT = new Date('2026-09-29T17:15:00Z');

/** The moment the in-game document was read. */
export const IN_GAME_AT = new Date('2026-09-29T19:09:00Z');

/** The moment the writer version 2 documents were read. */
export const FIELDS_AT = new Date('2026-09-29T20:08:00Z');

/** What the admin SDK hands the mapper for a timestamp field. */
class FakeTimestamp {
  constructor(private readonly iso: string) {}
  toDate(): Date {
    return new Date(this.iso);
  }
}

function revive(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(revive);
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (typeof o.__firestoreTimestamp === 'string' && Object.keys(o).length === 1) {
      return new FakeTimestamp(o.__firestoreTimestamp);
    }
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o)) out[k] = revive(o[k]);
    return out;
  }
  return v;
}

/** A stored document exactly as captured, timestamps revived. A fresh copy
 *  on every call, so a test may edit what it gets. */
export function loadDoc(name: string): Record<string, unknown> {
  return revive(JSON.parse(readFileSync(new URL(name, FIXTURES), 'utf-8'))) as Record<string, unknown>;
}

/** The same document as raw JSON text, for searching values the page must
 *  never contain. */
export function rawText(name: string): string {
  return readFileSync(new URL(name, FIXTURES), 'utf-8');
}

export interface CapturedVenuePage {
  slug: string;
  displayName: string;
  indexable: boolean;
}
interface Captured {
  teams: Team[];
  parks: Record<string, string>;
  venuePages: Record<string, CapturedVenuePage>;
}
const captured = JSON.parse(readFileSync(new URL('clubs.captured-20260929.json', FIXTURES), 'utf-8')) as Captured;

export function capturedTeams(): Team[] {
  return captured.teams.map((t) => ({ ...t }));
}

export function clubs(): Map<string, ClubInfo> {
  return new Map(
    captured.teams.map((t) => [
      t.id,
      { id: t.id, city: t.city, name: t.name, abbreviation: t.abbreviation, sportSlug: t.sportSlug, primaryColor: t.primaryColor },
    ]),
  );
}

/** Park names as getVenueForTeam returned them, by club. */
export function parkNames(): Map<string, string> {
  return new Map(Object.entries(captured.parks));
}

/** Venue pages as getTeamVenueHubMap returned them, by club. */
export function venuePages(): Map<string, CapturedVenuePage> {
  return new Map(Object.entries(captured.venuePages).map(([k, v]) => [k, { ...v }]));
}

/** What the data module builds from the two: the park name, and its page
 *  when the page is above the indexing floor. Built here by the same rule,
 *  from captured values, for the tests that do not go through the data
 *  module. data.test.ts holds the rule itself. */
export function parks(): Map<string, ParkInfo> {
  const pages = venuePages();
  const out = new Map<string, ParkInfo>();
  for (const [id, name] of parkNames()) {
    const p = pages.get(id);
    out.set(id, {
      name,
      page: p && p.indexable ? { href: `/venues/${p.slug}`, buildingSlug: p.slug, buildingName: p.displayName } : null,
    });
  }
  return out;
}

// ---- What a series key looks like ----
//
// The scans for a leaked series key match the forms the bracket documents
// actually use, and nothing looser. A loose pattern (letters, hyphen,
// letters, hyphen, letters) also matches "H-E-B", a grocery chain that
// sponsors Astros promotions, and a scan that cries wolf on a sponsor gets
// switched off.
//
//   MLB   AL-WC-A  NL-DS-B  AL-CS  NL-CS  WS
//   WNBA  R1-1v8   SF-A     F
//
// "WS" and "F" are too short to look for in free text. They are checked by
// name, in the places a key would sit: an attribute value, a link target.
export const SERIES_KEY_SHAPES: readonly RegExp[] = [
  /\b(?:AL|NL)-(?:WC|DS)-[A-Z]\b/,
  /\b(?:AL|NL)-CS\b/,
  /\bR\d-\dv\d\b/,
  /\bSF-[A-Z]\b/,
];

/** The first thing in `text` that has the form of a series key, or null. */
export function seriesKeyIn(text: string): string | null {
  for (const re of SERIES_KEY_SHAPES) {
    const m = re.exec(text);
    if (m) return m[0];
  }
  return null;
}

// ---- A Firestore that serves fixtures ----

export interface FakeRead {
  path: string;
  fieldMask: string[] | null;
}

/**
 * The slice of the admin SDK the postseason module uses: collection().doc()
 * and getAll(...refs, { fieldMask }), and for the postseason promotions
 * collection().doc().collection().where('f', '==', v).get(). It APPLIES the
 * mask, as Firestore does, so a test that passes proves the masked fields are
 * enough, and it answers an equality the way Firestore does: a document
 * without the field does not match. It records every read, so a test can
 * assert what was asked for.
 *
 * Documents are keyed by path: "postseasonBrackets/MLB_2026", or
 * "teams/houston-astros/promos/abc123" for a promotion row. A path stored as
 * an Error throws when read; a subcollection whose parent path is stored as
 * an Error throws when queried.
 */
/** A field mask applied the way Firestore applies one: "a.b" keeps field b
 *  of map a and nothing else of a. A path through a non-map keeps nothing. */
function applyMask(stored: Record<string, unknown>, mask: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const path of mask) {
    const parts = path.split('.');
    let from: unknown = stored;
    let to: Record<string, unknown> = out;
    for (let i = 0; i < parts.length; i++) {
      if (!from || typeof from !== 'object' || Array.isArray(from) || !(parts[i] in (from as object))) break;
      const v = (from as Record<string, unknown>)[parts[i]];
      if (i === parts.length - 1) {
        to[parts[i]] = v;
      } else {
        if (!to[parts[i]] || typeof to[parts[i]] !== 'object') to[parts[i]] = {};
        to = to[parts[i]] as Record<string, unknown>;
        from = v;
      }
    }
  }
  return out;
}

export function fakeFirestore(docs: Record<string, Record<string, unknown> | Error | undefined>) {
  const reads: FakeRead[] = [];
  const ref = (path: string) => ({
    path,
    collection(sub: string) {
      const prefix = `${path}/${sub}/`;
      const clauses: [string, unknown][] = [];
      const q = {
        where(field: string, op: string, value: unknown) {
          if (op !== '==') throw new Error(`the fake answers equality only, not ${op}`);
          clauses.push([field, value]);
          return q;
        },
        async get() {
          reads.push({ path: prefix.slice(0, -1), fieldMask: null });
          const parent = docs[path];
          if (parent instanceof Error) throw parent;
          const out: { id: string; data: () => Record<string, unknown>; ref: { parent: { parent: { id: string } } } }[] = [];
          for (const [p, stored] of Object.entries(docs)) {
            if (!p.startsWith(prefix) || stored === undefined) continue;
            if (stored instanceof Error) throw stored;
            if (!clauses.every(([f, v]) => f in stored && stored[f] === v)) continue;
            out.push({ id: p.slice(prefix.length), data: () => stored, ref: { parent: { parent: { id: path.split('/')[1] } } } });
          }
          return { docs: out, empty: out.length === 0, size: out.length };
        },
      };
      return q;
    },
  });
  const db = {
    reads,
    /** The documents, live: a test can change one between two reads. */
    docs,
    collection(name: string) {
      return {
        doc(id: string) {
          return ref(`${name}/${id}`);
        },
      };
    },
    async getAll(...args: unknown[]) {
      const last = args[args.length - 1] as { fieldMask?: string[] } | { path: string };
      const hasOptions = last !== undefined && !('path' in (last as object));
      const mask = hasOptions ? ((last as { fieldMask?: string[] }).fieldMask ?? null) : null;
      const refs = (hasOptions ? args.slice(0, -1) : args) as { path: string }[];
      return refs.map((r) => {
        reads.push({ path: r.path, fieldMask: mask });
        const stored = docs[r.path];
        if (stored instanceof Error) throw stored;
        const data: Record<string, unknown> | undefined =
          stored === undefined
            ? undefined
            : mask === null
              ? stored
              : applyMask(stored, mask);
        return {
          exists: stored !== undefined,
          data: () => data,
          get: (field: string) => (data ? data[field] : undefined),
        };
      });
    },
  };
  return db;
}

// ---- Deciding a captured bracket ----
//
// No 2026 bracket is finished, so the decided states are built here from a
// live capture by setting the stored fields the pipeline sets when a series
// ends: status, winner, wins. A slot that names a feeder resolves through
// the mapper as it does in production. A slot that names none (the WNBA
// semifinal and final slots, the MLB championship and World Series slots)
// is filled with the club and seed given. Every test that uses this says so.

type StoredDoc = Record<string, unknown>;
type StoredSeries = StoredDoc & { seriesKey: string; bestOf: number; higher: StoredDoc; lower: StoredDoc; wins: StoredDoc };

export interface Decision {
  winner: string;
  /** Clubs for slots with no feeder: [slug, seed]. */
  higher?: [string, number];
  lower?: [string, number];
}

export function decide(doc: StoredDoc, key: string, d: Decision): void {
  const s = (doc.series as StoredSeries[]).find((x) => x.seriesKey === key);
  if (!s) throw new Error(`no series ${key}`);
  if (d.higher) s.higher = { slug: d.higher[0], seed: d.higher[1] };
  if (d.lower) s.lower = { slug: d.lower[0], seed: d.lower[1] };
  const need = Math.ceil(s.bestOf / 2);
  // Which side won is read from the resolved slot by the mapper; the stored
  // wins only need the winner to have the majority. The higher slot is a
  // club here or the winner is the lower one.
  const higherSlug = (s.higher as { slug?: string }).slug;
  const winnerIsHigher = higherSlug === d.winner;
  s.status = 'final';
  s.winner = d.winner;
  s.wins = winnerIsHigher ? { higher: need, lower: need - 1 } : { higher: need - 1, lower: need };
}

/** The WNBA bracket, decided. Liberty over Lynx (as it happened), then
 *  Valkyries, Fever, Dream; Dream over Liberty, Valkyries over Fever;
 *  Valkyries over Dream. */
export function decidedWnba(): StoredDoc {
  const d = loadDoc(FIXTURE.wnbaLynxOut);
  decide(d, 'R1-2v7', { winner: 'golden-state-valkyries' });
  decide(d, 'R1-3v6', { winner: 'indiana-fever' });
  decide(d, 'R1-4v5', { winner: 'atlanta-dream' });
  decide(d, 'SF-A', { winner: 'atlanta-dream', higher: ['atlanta-dream', 4], lower: ['new-york-liberty', 8] });
  decide(d, 'SF-B', { winner: 'golden-state-valkyries', higher: ['golden-state-valkyries', 2], lower: ['indiana-fever', 6] });
  decide(d, 'F', { winner: 'golden-state-valkyries', higher: ['golden-state-valkyries', 2], lower: ['atlanta-dream', 4] });
  return d;
}

/** The MLB bracket, decided. White Sox (the coin flip goes against the
 *  pick), Yankees, Phillies, Padres; Yankees, Guardians, Brewers, Dodgers;
 *  Yankees over Guardians, Dodgers over Brewers; Dodgers over Yankees. */
export function decidedMlb(): StoredDoc {
  const d = loadDoc(FIXTURE.mlbWildCard);
  decide(d, 'AL-WC-A', { winner: 'chicago-white-sox' });
  decide(d, 'AL-WC-B', { winner: 'new-york-yankees' });
  decide(d, 'NL-WC-A', { winner: 'philadelphia-phillies' });
  decide(d, 'NL-WC-B', { winner: 'san-diego-padres' });
  decide(d, 'AL-DS-A', { winner: 'new-york-yankees' });
  decide(d, 'AL-DS-B', { winner: 'cleveland-guardians' });
  decide(d, 'NL-DS-A', { winner: 'milwaukee-brewers' });
  decide(d, 'NL-DS-B', { winner: 'los-angeles-dodgers' });
  decide(d, 'AL-CS', { winner: 'new-york-yankees', higher: ['cleveland-guardians', 2], lower: ['new-york-yankees', 4] });
  decide(d, 'NL-CS', { winner: 'los-angeles-dodgers', higher: ['milwaukee-brewers', 1], lower: ['los-angeles-dodgers', 2] });
  decide(d, 'WS', { winner: 'los-angeles-dodgers', higher: ['los-angeles-dodgers', 2], lower: ['new-york-yankees', 4] });
  return d;
}


// ---- The page's predictions, built the way ./data.ts builds them ----

export function mapPredicted(name: string): PredictedBracket {
  const d = loadDoc(name);
  const p = mapPredictedDoc(d, { league: d.league as 'MLB' | 'WNBA', season: d.season as number });
  if (!p) throw new Error(`${name} does not map`);
  return p;
}

export interface Built {
  bracket: Bracket;
  view: LeagueView;
  predicted: PredictedBracket;
  predictions: LeaguePredictions;
}

/** A stored bracket (a fixture name, or a document already edited) and a
 *  stored prediction, through the real mappers, the real view and the real
 *  assembly. */
export function buildWithPredictions(bracket: string | StoredDoc, predicted: string | StoredDoc, now: Date): Built {
  const bd = typeof bracket === 'string' ? loadDoc(bracket) : bracket;
  const b = mapBracketDoc(bd, { league: bd.league as 'MLB' | 'WNBA', season: bd.season as number });
  if (!b) throw new Error('bracket does not map');
  const v = buildLeagueView(b, clubs(), parks(), now);
  if (!v) throw new Error('bracket does not build');
  const pd = typeof predicted === 'string' ? loadDoc(predicted) : predicted;
  const p = mapPredictedDoc(pd, { league: pd.league as 'MLB' | 'WNBA', season: pd.season as number });
  if (!p) throw new Error('prediction does not map');
  const out = assemblePredictions(b, p, clubs(), seriesIds(b), v.rounds.map((r) => ({ key: r.key, label: r.label, shortLabel: r.shortLabel })));
  if (out instanceof Error) throw out;
  return { bracket: b, view: v, predicted: p, predictions: out };
}
