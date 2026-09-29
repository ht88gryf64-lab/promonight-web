// Test helpers for the postseason module. Not a test file: the suite glob is
// *.test.ts and *.test.tsx.
import { readFileSync } from 'node:fs';
import type { Team } from '../../types';
import type { ClubInfo } from '../view';

const FIXTURES = new URL('../__fixtures__/', import.meta.url);

export const FIXTURE = {
  mlbLive: 'MLB_2026.live-20260929T1715Z.json',
  wnbaLive: 'WNBA_2026.live-20260929T1715Z.json',
  mlbFinal: 'MLB_2025.final.json',
  wnbaFinal: 'WNBA_2025.final.json',
  mlbMixed: 'MLB_2025.replay-step-24.json',
  wnbaMixed: 'WNBA_2025.replay-step-10.json',
} as const;

/** The moment the two live documents were read. Tests that need a "now" use
 *  this one, so nothing depends on the day the suite runs. */
export const CAPTURED_AT = new Date('2026-09-29T17:15:00Z');

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

interface Captured {
  teams: Team[];
  parks: Record<string, string>;
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

export function parks(): Map<string, string> {
  return new Map(Object.entries(captured.parks));
}

// ---- A Firestore that serves fixtures ----

export interface FakeRead {
  path: string;
  fieldMask: string[] | null;
}

/**
 * The slice of the admin SDK the postseason module uses: collection().doc()
 * and getAll(...refs, { fieldMask }). It APPLIES the mask, as Firestore does,
 * so a test that passes proves the masked fields are enough. It records every
 * read, so a test can assert what was asked for.
 */
export function fakeFirestore(docs: Record<string, Record<string, unknown> | Error | undefined>) {
  const reads: FakeRead[] = [];
  const ref = (path: string) => ({ path });
  const db = {
    reads,
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
              : Object.fromEntries(mask.filter((k) => k in stored).map((k) => [k, stored[k]]));
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
