import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// DECISION 2026-09-02: CFB has no week numbers on this site. The date is the
// label. The stored cfbGames.week is a per-school ordinal on a doc both
// schools share (48 of 87 pages rendered a duplicate "Wk N"), and the rail's
// counter needed a hand-set anchor every August (it shipped one week off).
// Both are gone: no "Wk N" on a schedule row, no "WEEK N" on the hub rail,
// no week.ts, no read of the stored field. Rivalry Week is a named date
// window (rivalry-index.ts RIVALRY_WEEK_START/END) and stays.
//
// This scans the CFB surfaces' SOURCE. It cannot see a value assembled at
// runtime from pieces; the production check greps served HTML for the same
// strings, which is the half this test cannot do.

const ROOT = process.cwd();
const SURFACES = ['src/lib/cfb', 'src/components/cfb', 'src/app/cfb'].map((d) => join(ROOT, d));

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}
const files = SURFACES.flatMap((d) => (existsSync(d) ? walk(d) : []));
const rel = (f: string) => f.slice(ROOT.length + 1);

describe('CFB surfaces render no week number', () => {
  test('week.ts and its season anchor are gone', () => {
    assert.equal(existsSync(join(ROOT, 'src/lib/cfb/week.ts')), false);
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      assert.doesNotMatch(src, /cfb\/week'|cfbWeekNumber|cfbGameWeek|CFB_2026_WEEK_1_MONDAY/, rel(f));
    }
  });

  test('no "Wk N" and no "WEEK N" string on any CFB surface', () => {
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      // "Wk" as a rendered token (JSX text or a template), in any case.
      assert.doesNotMatch(src, /\bWk\b/i, rel(f));
      // "WEEK" followed by a number or an interpolation, or the old rail
      // heading. "Rivalry Week" (mixed case, a named window) is allowed.
      assert.doesNotMatch(src, /WEEK\s*(\$\{|\d)/, rel(f));
      assert.doesNotMatch(src, /THIS WEEK/, rel(f));
    }
  });

  test('nothing reads the stored cfbGames.week field', () => {
    for (const f of files) {
      if (rel(f) === 'src/lib/cfb/types.ts') continue; // the declaration, annotated UNUSED
      if (rel(f) === 'src/lib/cfb/rules.ts') continue; // computeWeeks is the pipeline WRITER's rule
      const src = readFileSync(f, 'utf8');
      assert.doesNotMatch(src, /\b(g|game|data|x\.data|d)\.week\b/, rel(f));
      assert.doesNotMatch(src, /weekLabel/, rel(f));
    }
    const types = readFileSync(join(ROOT, 'src/lib/cfb/types.ts'), 'utf8');
    assert.match(types, /UNUSED[\s\S]{0,400}week: number;/, 'types.ts must mark week as UNUSED');
  });

  test('the schedule view carries a date and a played flag, not a week', () => {
    const data = readFileSync(join(ROOT, 'src/lib/cfb/data.ts'), 'utf8');
    const view = data.slice(data.indexOf('export interface CfbGameView'), data.indexOf('export interface CfbSchoolPage'));
    assert.match(view, /\bdate: string/);
    assert.match(view, /\bplayed: boolean/);
    assert.doesNotMatch(view, /^\s*week\w*\s*[?:]/im, 'no week-shaped property on the view');
  });

  test('the hub rail is labelled by a date range', () => {
    const hub = readFileSync(join(ROOT, 'src/lib/cfb/hub-data.ts'), 'utf8');
    assert.match(hub, /range: string \| null/);
    assert.match(hub, /dateRangeLabel\(weekStart, weekEnd\)/);
    const page = readFileSync(join(ROOT, 'src/app/cfb/page.tsx'), 'utf8');
    assert.match(page, /RIVALRY GAMES · \$\{data\.weekly\.range\}/);
  });
});
