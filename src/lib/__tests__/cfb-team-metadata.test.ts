// /cfb/[school] titles and descriptions (src/lib/cfb/metadata.ts), after the
// 2026-10-29 rewrite:
//  - every title is "[School Mascot] Football Schedule 2026", "& Gameday" when
//    it fits, the school name alone when the mascot overruns the field;
//  - the rivalry is named in the description only, as a trophy or marquee
//    name ("The Game vs Michigan") or, with no trophy, "the {rival} rivalry",
//    never the stored "School–School" pair label;
//  - no title repeats a word, and the rendered title stays within 60;
//  - an untracked opponent is named from the explicit map ("UAB", not "Uab").
import { test } from 'node:test';
import assert from 'node:assert';
import { buildCfbTeamMetadata, selectFeaturedRivalry } from '@/lib/cfb/metadata';
import { prettySchoolId } from '@/lib/cfb/matchup-description';
import type { CfbSchoolPage } from '@/lib/cfb/data';

type Riv = { name: string; trophy: string | null };
function page(name: string, mascot: string, games: Array<{ opp: string; rivalry?: Riv }>, venue = 'Memorial Stadium'): CfbSchoolPage {
  return {
    school: { id: name.toLowerCase().replace(/\s+/g, '-'), name, shortName: name, mascot },
    venue: venue ? { name: venue } : null,
    games: games.map((g, i) => ({
      id: `g${i}`, date: `2026-10-${String(10 + i).padStart(2, '0')}`, played: false, isHome: true, neutralSite: false, internationalVenue: null,
      conferenceGame: null, themes: [], opponentId: g.opp.toLowerCase(), opponentName: g.opp, kickoffDisplay: 'Kickoff TBA', kickoffVerified: false,
      networkDisplay: null, rivalry: g.rivalry ? { id: 'r', name: g.rivalry.name, trophy: g.rivalry.trophy, sourceUrl: null } : null,
      opponentTracked: true, awaySchool: null, awayVenue: null,
    })),
  } as unknown as CfbSchoolPage;
}
const titleOf = (p: CfbSchoolPage) => String(buildCfbTeamMetadata(p).title);
const descOf = (p: CfbSchoolPage) => String(buildCfbTeamMetadata(p).description);
const repeatsAWord = (t: string) => { const w = t.toLowerCase().split(/\s+/); return new Set(w).size !== w.length; };

test('title is School Mascot Football Schedule 2026, & Gameday when it fits, rivalry nowhere in it', () => {
  const minn = page('Minnesota', 'Golden Gophers', [{ opp: 'Wisconsin', rivalry: { name: "Paul Bunyan's Axe", trophy: "Paul Bunyan's Axe" } }]);
  assert.equal(titleOf(minn), 'Minnesota Golden Gophers Football Schedule 2026');
  assert.equal(titleOf(page('Army', 'Black Knights', [{ opp: 'Navy', rivalry: { name: 'Army–Navy Game', trophy: null } }])), 'Army Black Knights Football Schedule 2026');
  assert.equal(titleOf(page('Air Force', 'Falcons', [{ opp: 'Navy' }])), 'Air Force Falcons Football Schedule 2026');
  assert.equal(titleOf(page('Oregon', 'Ducks', [{ opp: 'USC' }])), 'Oregon Ducks Football Schedule 2026 & Gameday', '& Gameday when it fits');
});

test('a name plus mascot that overruns the field falls back to the school name, year kept', () => {
  const t = titleOf(page('Coastal Carolina', 'Chanticleers', [{ opp: 'Liberty', rivalry: { name: 'Coastal Carolina–Liberty', trophy: null } }]));
  assert.equal(t, 'Coastal Carolina Football Schedule 2026');
  assert.ok(t.length <= 47);
});

test('every title shape is within the 60-char rendered budget and repeats no word', () => {
  const pages = [
    page('Minnesota', 'Golden Gophers', []), page('Army', 'Black Knights', []), page('Maryland', 'Terrapins', []), page('Oregon', 'Ducks', []),
    page('UConn', 'Huskies', []), page('Memphis', 'Tigers', []), page('Cincinnati', 'Bearcats', []), page('Air Force', 'Falcons', []),
    page('Georgia Tech', 'Yellow Jackets', []), page('Notre Dame', 'Fighting Irish', []), page('Washington State', 'Cougars', []),
  ];
  for (const p of pages) {
    const t = titleOf(p);
    assert.ok(`${t} | PromoNight`.length <= 60, `${t} renders within 60`);
    assert.ok(!repeatsAWord(t), `${t} repeats no word`);
    assert.ok(/Football Schedule 2026/.test(t), `${t} keeps the head term and the year`);
  }
});

test('description names the rivalry: marquee and trophy by name, a trophy-less rivalry as "the {rival} rivalry"', () => {
  const marquee = page('Michigan', 'Wolverines', [{ opp: 'Ohio State', rivalry: { name: 'The Game', trophy: null } }]);
  assert.match(descOf(marquee), /The Game vs Ohio State, /);
  const trophy = page('Memphis', 'Tigers', [{ opp: 'UAB', rivalry: { name: 'The Bones', trophy: 'The Bones' } }]);
  assert.match(descOf(trophy), /The Bones vs UAB, /);
  const pair = page('Maryland', 'Terrapins', [{ opp: 'Rutgers', rivalry: { name: 'Maryland–Rutgers', trophy: null } }]);
  assert.match(descOf(pair), /the Rutgers rivalry, /);
  assert.ok(!descOf(pair).includes('Maryland–Rutgers'), 'the pair label never reaches the description');
  assert.equal(selectFeaturedRivalry(pair).source, 'rivalry');
  assert.equal(selectFeaturedRivalry(pair).name, null);
  // A dashed trophy that names no school is still a trophy.
  const dashedTrophy = page('Virginia', 'Cavaliers', [{ opp: 'Florida State', rivalry: { name: 'Jefferson–Eppes Trophy', trophy: 'Jefferson–Eppes Trophy' } }]);
  assert.match(descOf(dashedTrophy), /Jefferson–Eppes Trophy vs Florida State, /);
  // A pair-label trophy is skipped in favour of a real trophy on another game.
  const mixed = page('Oregon', 'Ducks', [
    { opp: 'USC', rivalry: { name: 'Oregon–USC', trophy: 'Oregon–USC' } },
    { opp: 'Oregon State', rivalry: { name: 'Platypus Trophy', trophy: 'Platypus Trophy' } },
  ]);
  assert.match(descOf(mixed), /Platypus Trophy vs Oregon State, /);
  const none = page('Air Force', 'Falcons', [{ opp: 'Navy' }]);
  assert.ok(!/rivalry|vs/.test(descOf(none)), 'no rivalry claim without a rivalry game');
  for (const p of [marquee, trophy, pair, dashedTrophy, mixed, none]) assert.ok(descOf(p).length <= 155);
});

test('an untracked opponent is named from the explicit map', () => {
  assert.equal(prettySchoolId('uab'), 'UAB');
  assert.equal(prettySchoolId('miami-oh'), 'Miami (OH)');
  assert.equal(prettySchoolId('utsa'), 'UTSA');
  assert.equal(prettySchoolId('william-mary'), 'William & Mary');
  assert.equal(prettySchoolId('washington-state'), 'Washington State', 'an id that title-cases correctly is untouched');
});

test('a trophy-less rivalry with a real name keeps that name in the description', () => {
  const bigGame = page('California', 'Golden Bears', [{ opp: 'Stanford', rivalry: { name: 'Big Game', trophy: null } }]);
  assert.match(descOf(bigGame), /Big Game vs Stanford, /);
  assert.equal(selectFeaturedRivalry(bigGame).name, 'Big Game');
  // A pair label as the name with no trophy still falls to "the {rival} rivalry".
  const pairOnly = page('Houston', 'Cougars', [{ opp: 'Texas Tech', rivalry: { name: 'Houston–Texas Tech', trophy: null } }]);
  assert.match(descOf(pairOnly), /the Texas Tech rivalry, /);
});
