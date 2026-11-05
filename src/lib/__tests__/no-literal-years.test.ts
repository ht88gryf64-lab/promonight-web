// NO LITERAL YEAR IN WHAT THE SITE RENDERS (ruling 2026-11-05, season rollover).
//
// Every season year the site prints comes from src/lib/seasons/windows.json
// through seasonLabel(league, date), or from the dates of the rows on the page,
// never from a hardcoded 2026 that someone has to remember to bump. This scans
// the source: any 20xx literal in CODE (comments stripped) under src/ fails,
// unless the file is a fixture or test (exempt by path) or the exact literal
// sits on the named allowlist below with its reason.
//
// Adding to the allowlist needs a reason a reviewer would accept: a proper
// noun (the 2026 World Cup), a dated fact about the past (a legal effective
// date, a ruling date that gates a rollout), or the season table itself. A
// season label is never a valid reason: route it through seasonLabel().
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SCAN = 'src';
const EXT = /\.(ts|tsx|js|mjs|cjs|json)$/;

/** Exempt by path (ruling 6: fixtures and scripts). scripts/ is outside src/. */
function exemptPath(rel: string): boolean {
  return (
    /(^|\/)(__tests__|__fixtures__|fixtures)\//.test(rel) ||
    /\.(test|spec)\.(ts|tsx)$/.test(rel)
  );
}

/**
 * The named allowlist: file -> literals allowed in it, each with its reason.
 * A literal not listed for its file fails. Keep entries exact.
 */
const ALLOW: Record<string, { years: RegExp; reason: string }> = {
  // The season table itself.
  'src/lib/seasons/windows.json': { years: /.*/, reason: 'the season table: every date is a sourced season boundary' },
  // Event names and their fixed calendars.
  'src/app/world-cup/page.tsx': { years: /^2026/, reason: 'event name: FIFA World Cup 2026, and its fixed tournament dates' },
  'src/components/world-cup/host-card.tsx': { years: /^2026/, reason: 'event name: FIFA World Cup 2026' },
  'src/components/world-cup/game-rows.tsx': { years: /^2026/, reason: 'event name: FIFA World Cup 2026' },
  'src/data/world-cup-cities.ts': { years: /^2026/, reason: 'World Cup 2026 fixture dates (a fixed tournament schedule)' },
  'src/lib/world-cup-active.ts': { years: /^2026/, reason: 'World Cup 2026 tournament window (fixed event dates)' },
  'src/app/promos/soccer-jersey-nights/page.tsx': { years: /^2026/, reason: 'the 2026 World Cup (event name) and its tournament dates, which the jersey-night count is measured against' },
  'src/components/redesign/Footer.tsx': { years: /^2026$/, reason: "event name: the 'World Cup 2026' footer link" },
  // Legal and publication dates.
  'src/app/privacy/page.tsx': { years: /^20\d\d/, reason: 'legal: the policy effective / last-updated date' },
  'src/app/terms/page.tsx': { years: /^20\d\d/, reason: 'legal: the terms effective / last-updated date' },
  'src/components/json-ld.tsx': { years: /^2025-12-01$/, reason: "the site's publication date (WebSite datePublished), a fixed fact" },
  'src/lib/about-copy.ts': { years: /^2026/, reason: "dated facts: the page's last-reviewed stamp and when NHL joined the weekly scan" },
  // Dated facts about the past (rulings, verifications, provenance).
  'src/lib/announcement-status.ts': { years: /^20\d\d-\d\d-\d\d$/, reason: 'the dates each "has not announced" claim was verified; the claim expires by date' },
  'src/lib/season-scope.ts': { years: /^2026-10-01$/, reason: 'the MLB season-scope rollout date, a past ruling date that gates nothing visible' },
  'src/lib/postseason/predictions.ts': { years: /^2025$/, reason: 'the backtest ran on the 2025 postseason, a historical fact' },
  'src/lib/venue-bag-holds.ts': { years: /^2026-11$/, reason: 'a file path: the ops ticket the holds cite' },
  'src/lib/venue-bag-policies.ts': { years: /^2026$/, reason: 'dated verification claim: the bag policies were verified for the 2026 season; re-verification, not a label rollover, moves it' },
  'src/lib/venue-hub.ts': { years: /^2026$/, reason: 'dated verification claim: the venue guides were verified for the 2026 season; re-verification, not a label rollover, moves it' },
  'src/lib/venue-corpus-silence.ts': { years: /^20[12]\d/, reason: 'dated provenance facts about venue sources (verifiedOn dates, past-season notes)' },
  'src/lib/venue-field-exclusions.ts': { years: /^20[12]\d/, reason: 'dated provenance facts: the year each excluded source was published' },
  'src/lib/venue-locations.ts': { years: /^20[12]\d/, reason: 'dated facts: stadium rename years and a planned opening' },
  'src/lib/venue-transit-suppression.ts': { years: /^20[12]\d/, reason: 'dated facts: transit notices and the dates they took effect' },
  'src/lib/cfb/rivalry-index.ts': { years: /^2026-11-(21|29)$/, reason: 'the 2026 Rivalry Week bounds, a dated config the copy prints from; season-gate.test.ts fails from 60 days before the next CFB lead-in until they move' },
  // Not a label: keys and references.
  'src/app/dev/affiliate-check/page.tsx': { years: /^2026-05-03$/, reason: 'internal dev page: the date the SeatGeek and StubHub columns were retired, a past fact' },
  'src/lib/format-game-time.ts': { years: /^2026$/, reason: 'a fixed reference date used only to format a clock time; no year is rendered' },
  'src/config/social-bridge.json': { years: /^20\d\d-\d\d-\d\d$/, reason: 'generatedAt: the generation stamp of a generated file' },
  'src/lib/postseason/data.ts': { years: /^2026$/, reason: 'POSTSEASON_SEASON is the postseasonBrackets document key; the playoffs pages print the season of the bracket they read. ROLLOVER ITEM: moves when the 2027 brackets are written (ruling needed on the rule)' },
};

// ---- a small JS/TS lexer: drop comments, keep strings and code ----
function stripComments(src: string): string {
  let out = '';
  let i = 0;
  const n = src.length;
  // Template-literal nesting: each entry is the brace depth at which a ${ opened.
  const tpl: number[] = [];
  let depth = 0;
  let inTpl = false;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (inTpl) {
      if (c === '\\') { out += c + (d ?? ''); i += 2; continue; }
      if (c === '`') { inTpl = false; out += c; i++; continue; }
      if (c === '$' && d === '{') { tpl.push(depth); depth++; inTpl = false; out += '${'; i += 2; continue; }
      out += c; i++; continue;
    }
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') out += '\n'; i++; } i += 2; continue; }
    if (c === '"' || c === "'") {
      const q = c; out += c; i++;
      while (i < n && src[i] !== q && src[i] !== '\n') { if (src[i] === '\\') { out += src[i]; i++; } out += src[i] ?? ''; i++; }
      out += src[i] ?? ''; i++; continue;
    }
    if (c === '`') { inTpl = true; out += c; i++; continue; }
    if (c === '{') { depth++; out += c; i++; continue; }
    if (c === '}') {
      depth--;
      if (tpl.length && tpl[tpl.length - 1] === depth) { tpl.pop(); inTpl = true; }
      out += c; i++; continue;
    }
    out += c; i++;
  }
  return out;
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (EXT.test(name)) acc.push(full);
  }
  return acc;
}

// A year 2010 to 2039, not part of an identifier (CONFERENCE_2026, MLB_2026),
// a decimal, or a \u escape (\u2019 is an apostrophe, not a year).
const YEAR = /(?<![\w.\\])20[1-3]\d(?:-\d\d(?:-\d\d)?)?(?!\d)/g;

export function literalYears(): { file: string; line: number; literal: string; text: string }[] {
  const hits: { file: string; line: number; literal: string; text: string }[] = [];
  for (const full of walk(join(ROOT, SCAN))) {
    const rel = relative(ROOT, full);
    if (exemptPath(rel)) continue;
    const raw = readFileSync(full, 'utf-8');
    const code = rel.endsWith('.json') ? raw : stripComments(raw);
    code.split('\n').forEach((text, idx) => {
      for (const m of text.matchAll(YEAR)) {
        const allow = ALLOW[rel];
        if (allow && allow.years.test(m[0])) continue;
        hits.push({ file: rel, line: idx + 1, literal: m[0], text: text.trim().slice(0, 140) });
      }
    });
  }
  return hits;
}

test('the lexer drops comments and keeps strings', () => {
  const s = stripComments("const a = 'x // 2026'; // 2027\n/* 2028 */ const b = `y ${c /* 2029 */} 2030`;");
  assert.ok(s.includes("'x // 2026'"));
  assert.ok(!s.includes('2027') && !s.includes('2028') && !s.includes('2029'));
  assert.ok(s.includes('2030'));
});

test('no literal year in src/ outside fixtures, tests and the named allowlist', () => {
  const hits = literalYears();
  assert.deepEqual(
    hits.map((h) => `${h.file}:${h.line}  ${h.literal}  | ${h.text}`),
    [],
    'Route a season year through seasonLabel(league, date) (src/lib/seasons/season-window.ts), take a date from the rows, or add an allowlist entry with a reason.',
  );
});

test('every allowlist entry is still needed', () => {
  for (const file of Object.keys(ALLOW)) {
    const raw = readFileSync(join(ROOT, file), 'utf-8');
    const code = file.endsWith('.json') ? raw : stripComments(raw);
    assert.ok([...code.matchAll(YEAR)].some((m) => ALLOW[file].years.test(m[0])), `${file}: allowlisted but no longer carries a matching literal; remove the entry`);
  }
});
