import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { teamDisplayName } from '../team-display-name';

// Every MLS team record as stored on 2026-11-03 (city, name) and the club's
// own brand. A wrong pair here was a wrong name on live pages.
const MLS: [string, string, string][] = [
  ['Atlanta', 'United FC', 'Atlanta United FC'],
  ['Austin', 'Austin FC', 'Austin FC'],
  ['Montreal', 'CF Montréal', 'CF Montréal'],
  ['Charlotte', 'Charlotte FC', 'Charlotte FC'],
  ['Chicago', 'Fire FC', 'Chicago Fire FC'],
  ['Colorado', 'Rapids', 'Colorado Rapids'],
  ['Columbus', 'Crew', 'Columbus Crew'],
  ['D.C.', 'United', 'D.C. United'],
  ['Cincinnati', 'FC Cincinnati', 'FC Cincinnati'],
  ['Dallas', 'FC Dallas', 'FC Dallas'],
  ['Houston', 'Dynamo FC', 'Houston Dynamo FC'],
  ['Miami', 'Inter CF', 'Inter Miami CF'],
  ['Los Angeles', 'Galaxy', 'Los Angeles Galaxy'],
  ['Los Angeles', 'LAFC', 'LAFC'],
  ['Minnesota', 'United FC', 'Minnesota United FC'],
  ['Nashville', 'Nashville SC', 'Nashville SC'],
  ['New England', 'Revolution', 'New England Revolution'],
  ['New York', 'City FC', 'New York City FC'],
  ['New York', 'Red Bulls', 'New York Red Bulls'],
  ['Orlando', 'City SC', 'Orlando City SC'],
  ['Philadelphia', 'Union', 'Philadelphia Union'],
  ['Portland', 'Timbers', 'Portland Timbers'],
  ['Salt Lake', 'Real', 'Real Salt Lake'],
  ['San Diego', 'San Diego FC', 'San Diego FC'],
  ['San Jose', 'Earthquakes', 'San Jose Earthquakes'],
  ['Seattle', 'Sounders FC', 'Seattle Sounders FC'],
  ['Kansas City', 'Sporting', 'Sporting Kansas City'],
  ['St. Louis', 'City SC', 'St. Louis City SC'],
  ['Toronto', 'Toronto FC', 'Toronto FC'],
  ['Vancouver', 'Whitecaps FC', 'Vancouver Whitecaps FC'],
];

test('every MLS club reads as its own brand', () => {
  for (const [city, name, want] of MLS) assert.equal(teamDisplayName({ city, name }), want, `${city} | ${name}`);
});

test('ordinary city + nickname pairs are unchanged', () => {
  assert.equal(teamDisplayName({ city: 'Kansas City', name: 'Royals' }), 'Kansas City Royals');
  assert.equal(teamDisplayName({ city: 'Montreal', name: 'Canadiens' }), 'Montreal Canadiens');
  assert.equal(teamDisplayName({ city: 'Golden State', name: 'Valkyries' }), 'Golden State Valkyries');
  assert.equal(teamDisplayName({ city: 'Los Angeles', name: 'Dodgers' }), 'Los Angeles Dodgers');
  assert.equal(teamDisplayName({ city: '', name: 'Sky' }), 'Sky');
  assert.equal(teamDisplayName({ city: 'Chicago', name: '' }), 'Chicago');
  // A city that is only part of a word is not "in" the name.
  assert.equal(teamDisplayName({ city: 'Ann', name: 'Annapolis Club' }), 'Ann Annapolis Club');
});

// GUARD: a reader-facing city + name join (template literal or JSX) is how the
// wrong names got out. The raw joins left are venue lookup keys that must match
// the venues collection's stored `team` string byte for byte, plus team
// search, which matches the raw join as well as the display name.
test('no raw city + name join outside the venue lookup keys', () => {
  const ALLOWED = new Set([
    'src/lib/data.ts:const fullName = `${team.city} ${team.name}`;',
    'src/lib/data.ts:for (const t of teams) fullNameToId.set(`${t.city} ${t.name}`, t.id);',
    'src/app/api/my-teams/promos/route.ts:const fullName = `${teamData.city} ${teamData.name}`;',
    'src/components/team-search.tsx:`${t.city} ${t.name}`.toLowerCase().includes(query.toLowerCase()) ||',
  ]);
  const RAW = /\$?\{\s*[\w.]*city\s*\}\s\$?\{\s*[\w.]*name\s*\}/;
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== '__tests__' && e.name !== '__fixtures__') walk(p); continue; }
      if (!/\.(ts|tsx)$/.test(e.name)) continue;
      fs.readFileSync(p, 'utf8').split('\n').forEach((line) => {
        const t = line.trim();
        if (t.startsWith('//') || t.startsWith('*')) return; // comments may describe the join
        if (RAW.test(line)) hits.push(`${p}:${t}`);
      });
    }
  };
  walk('src');
  // src/lib/postseason/ is the MLB/WNBA bracket code, whose clubs all read
  // correctly as city + nickname; the MLS postseason build brings it under
  // this rule (OPS, 2026-11-03). The helper itself is the one place the join
  // is written on purpose.
  const unexpected = hits.filter((h) => !ALLOWED.has(h) && !h.startsWith('src/lib/postseason/') && !h.startsWith('src/lib/team-display-name.ts:'));
  assert.deepEqual(unexpected, [], 'use teamDisplayName for anything a reader sees');
});
