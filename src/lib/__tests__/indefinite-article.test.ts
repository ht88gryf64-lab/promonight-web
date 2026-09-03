// The a/an helper. See known-issues entry 42.
//
// It shipped as a bare "a", rendering "a Atlanta Braves game" on truist-park in
// both the visible H2 and the FAQPage JSON-LD. The same literal was then found
// at two more live sites, one of which also feeds structured data.
//
// The cases below are not invented. The name cases come from the 115 distinct
// tenant display names resolved across the 222 venue hubs and from the 169 team
// records; the numeric cases come from the two clubs that actually reach the
// helper through HotelsCTA. The module imports nothing, so this needs no mocks.
import { test } from 'node:test';
import assert from 'node:assert';
import { indefiniteArticleFor } from '../indefinite-article';

const an = (names: string[], why: string) => {
  for (const n of names) assert.equal(indefiniteArticleFor(n), 'an', `${n}: ${why}`);
};
const a = (names: string[], why: string) => {
  for (const n of names) assert.equal(indefiniteArticleFor(n), 'a', `${n}: ${why}`);
};

test('vowel-initial names take "an"', () => {
  an([
    'Atlanta Braves', 'Atlanta United FC', 'Arizona Diamondbacks', 'Arizona State',
    'Alabama', 'Arkansas', 'Illinois', 'Iowa', 'Iowa State', 'Indiana Fever',
    'Indianapolis Colts', 'Oakland Athletics', 'Oklahoma State', 'Ole Miss',
    'Orlando City SC', 'Anaheim Ducks', 'Edmonton Oilers', 'Ottawa Senators',
    'Austin FC', 'Angels', 'Astros', 'Orioles', 'Eagles', 'Aces', 'Islanders',
  ], 'opens with a vowel sound');
});

test('consonant-initial names take "a"', () => {
  a([
    'Chicago Cubs', 'Texas Rangers', 'St. Louis Cardinals', 'New York Yankees',
    'Los Angeles Dodgers', 'Philadelphia Union', 'Green Bay Packers', 'Purdue',
    'Kansas City Royals', 'Seattle Sounders FC', 'Detroit Tigers',
  ], 'opens with a consonant sound');
});

// The whole reason the rule is sound-based rather than spelling-based.
test('vowel LETTER with a "yoo" consonant sound takes "a"', () => {
  a(['UCLA', 'UConn', 'USF', 'Utah', 'Union Omaha'], 'opens "yoo", not a vowel sound');
});

test('consonant LETTER initialism with a vowel sound takes "an"', () => {
  an(['NC State', 'LAFC', 'FC Dallas', 'FC Cincinnati'], 'the spoken letter opens with a vowel');
});

test('initialisms whose first letter is spoken as a consonant take "a"', () => {
  a(['BYU', 'TCU', 'D.C. United'], 'the spoken letter opens with a consonant');
});

// Numeric-leading names are SPOKEN, not spelled. Stripping the digits and
// deciding on the letters that follow returned "an 76ers game", which is the
// defect this block pins.
test('numeric-leading names are decided on the spoken number', () => {
  a(['76ers'], '"seventy-sixers" opens with a consonant');
  a(['49ers'], '"forty-niners" opens with a consonant');
  an(['8 Ball'], '"eight" opens with a vowel');
});

test('the number rule reads only the FIRST spoken word', () => {
  // teens, tens and hundreds all resolve on their opening word
  an(['11 Series', '18 Wheelers', '80s Night', '800 Club', '8000 Club'],
    'opens "eleven" / "eighteen" / "eighty" / "eight"');
  a(['1 Nation', '76 Trombones', '49 Steps', '100 Club', '1976 Club', '20 Mule Team'],
    'opens "one" / "seventy" / "forty" / "one" / "one" / "twenty"');
  // "one" opens with a /w/ sound, so a vowel LETTER must not decide it
  a(['1st and Ten'], '"one" opens /w/, not a vowel sound');
});

test('degenerate input does not throw', () => {
  a(['', '   ', '123 Sports', '-', '!!!'], 'nothing to decide on falls back to "a"');
});
