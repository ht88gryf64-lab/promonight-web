// The rivalry page's heading and <title> (src/lib/cfb/metadata.ts): both
// schools lead a trophy name, within 60 rendered characters.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

mock.module('server-only', { namedExports: {} });

test('a trophy name is led by the pairing; a name that is the pairing is left alone', async () => {
  const { matchupHeading, matchupTitle, MATCHUP_TITLE_MAX } = await import('../cfb/metadata');
  assert.equal(MATCHUP_TITLE_MAX, 60);
  assert.equal(matchupHeading("Paul Bunyan's Axe", 'Minnesota', 'Wisconsin', '2026'), "Minnesota vs Wisconsin: Paul Bunyan's Axe 2026");
  assert.equal(matchupTitle("Paul Bunyan's Axe", 'Minnesota', 'Wisconsin', '2026'), "Minnesota vs Wisconsin: Paul Bunyan's Axe 2026 | PromoNight");
  assert.equal(matchupHeading('Florida vs Georgia', 'Florida', 'Georgia', '2026'), 'Florida vs Georgia 2026');
  assert.equal(matchupTitle('Florida vs Georgia', 'Florida', 'Georgia', '2026'), 'Florida vs Georgia 2026 | PromoNight');
  assert.equal(matchupHeading('UCLA vs. USC', 'UCLA', 'USC', '2026'), 'UCLA vs. USC 2026');
});

test('the 60-character cascade: brand, then nothing else until it must', async () => {
  const { matchupTitle } = await import('../cfb/metadata');
  // 60 exactly keeps the brand.
  const sixty = matchupTitle('Sunflower Showdown', 'Kansas', 'Kansas State', '2026');
  assert.equal(sixty, 'Kansas vs Kansas State: Sunflower Showdown 2026 | PromoNight');
  assert.equal(sixty.length, 60);
  // One character more drops the brand and keeps the heading whole.
  assert.equal(matchupTitle('Third Saturday in October', 'Alabama', 'Tennessee', '2026'), 'Alabama vs Tennessee: Third Saturday in October 2026');
  assert.equal(matchupTitle('Clean, Old-Fashioned Hate', 'Georgia', 'Georgia Tech', '2026'), 'Georgia vs Georgia Tech: Clean, Old-Fashioned Hate 2026');
  // A heading over 60 loses its season, then the name; never a mid-word cut.
  const long = matchupTitle('The Battle for the Old Brass Spittoon Trophy', 'Michigan State', 'Indiana', '2026');
  assert.equal(long, 'Michigan State vs Indiana 2026');
  const mid = matchupTitle('Battle for the Iron Skillet Cup', 'Southern Methodist', 'TCU', '2026');
  assert.equal(mid, 'Southern Methodist vs TCU: Battle for the Iron Skillet Cup');
  assert.ok(mid.length <= 60);
  for (const t of [sixty, long, mid]) assert.doesNotMatch(t, /—|–|\.\.\.$/);
});

test('the page takes its title and H1 from the one heading, and adds no date or network to the title', () => {
  const meta = readFileSync(new URL('../cfb/metadata.ts', import.meta.url), 'utf-8');
  assert.match(meta, /title: \{ absolute: title \},/);
  assert.match(meta, /const title = matchupTitle\(data\.displayName, nameA, nameB, cfbSeasonLabel\(\)\);/);
  const fn = meta.slice(meta.indexOf('export function matchupTitle'), meta.indexOf('export function matchupSchoolNames'));
  assert.doesNotMatch(fn, /\b(kickoff|network|broadcast|date|tv)\b/i);
  const page = readFileSync(new URL('../../components/cfb/rivalry/RivalryMatchupPage.tsx', import.meta.url), 'utf-8');
  // When the name is not the pairing, the matchup line is inside the H1, first in its text.
  const h1 = page.slice(page.indexOf('<h1 className="mt-3 flex flex-col-reverse">'), page.indexOf('</h1>', page.indexOf('<h1 className="mt-3 flex flex-col-reverse">')));
  assert.ok(h1.indexOf('<SchoolName school={a}') < h1.indexOf('{data.displayName} {Number(cfbSeasonLabel())}'));
  assert.match(h1, /<span className="sr-only">: <\/span>/);
});
