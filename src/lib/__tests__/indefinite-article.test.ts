// The parking FAQ question is ONE string feeding both the visible H2 and the
// FAQPage JSON-LD, so a wrong article ships into structured data with no page
// for a consumer to check it against. It shipped as a bare "a" and rendered
// "a Atlanta Braves game" on truist-park.
//
// The cases below are not invented: they are drawn from the 115 distinct tenant
// display names actually resolved across the 222 venue hubs. The four "yoo"
// names and the one initialism are exactly why a naive vowel-letter test is not
// good enough here.
import { test, mock } from 'node:test';
import assert from 'node:assert';

mock.module('server-only', { namedExports: {} });
mock.module(new URL('../firebase.ts', import.meta.url).href, { namedExports: { db: {} } });

const load = () => import('../venue-hub');

test('vowel-initial tenant names take "an"', async () => {
  const { indefiniteArticleFor } = await load();
  for (const n of [
    'Atlanta Braves', 'Atlanta United FC', 'Arizona Diamondbacks', 'Arizona State',
    'Alabama', 'Arkansas', 'Illinois', 'Iowa', 'Iowa State', 'Indiana Fever',
    'Indianapolis Colts', 'Oakland Athletics', 'Oklahoma State', 'Ole Miss',
    'Orlando City SC',
  ]) {
    assert.equal(indefiniteArticleFor(n), 'an', `${n} should take "an"`);
  }
});

test('consonant-initial tenant names take "a"', async () => {
  const { indefiniteArticleFor } = await load();
  for (const n of [
    'Chicago Cubs', 'Texas Rangers', 'St. Louis Cardinals', 'New York Yankees',
    'Los Angeles Dodgers', 'Philadelphia Union', 'Green Bay Packers', 'Purdue',
    'Kansas City Royals', 'Seattle Sounders FC',
  ]) {
    assert.equal(indefiniteArticleFor(n), 'a', `${n} should take "a"`);
  }
});

// The whole reason this helper is sound-based rather than spelling-based.
test('vowel LETTER with a "yoo" consonant sound takes "a"', async () => {
  const { indefiniteArticleFor } = await load();
  for (const n of ['UCLA', 'UConn', 'USF', 'Utah']) {
    assert.equal(indefiniteArticleFor(n), 'a', `${n} should take "a", not "an"`);
  }
});

// "NC" is spoken "en see", so the vowel sound is real even though N is not a vowel.
test('consonant LETTER initialism with a vowel sound takes "an"', async () => {
  const { indefiniteArticleFor } = await load();
  assert.equal(indefiniteArticleFor('NC State'), 'an');
});

test('initialisms whose first letter is spoken as a consonant take "a"', async () => {
  const { indefiniteArticleFor } = await load();
  for (const n of ['BYU', 'TCU', 'D.C. United']) {
    assert.equal(indefiniteArticleFor(n), 'a', `${n} should take "a"`);
  }
});

test('degenerate input does not throw', async () => {
  const { indefiniteArticleFor } = await load();
  assert.equal(indefiniteArticleFor(''), 'a');
  assert.equal(indefiniteArticleFor('   '), 'a');
  assert.equal(indefiniteArticleFor('123 Sports'), 'a');
});
