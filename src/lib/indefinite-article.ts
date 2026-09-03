/**
 * "a" or "an" for an interpolated team, school or venue name.
 *
 * WHY THIS EXISTS. Copy generators used to write the article as a literal "a"
 * before an interpolated name, which shipped "a Atlanta Braves game" on
 * truist-park in both the visible H2 and the FAQPage JSON-LD. See known-issues
 * entry 42.
 *
 * WHY IT LIVES IN ITS OWN MODULE. It started inside venue-hub.ts, which imports
 * `server-only` and the Firestore client. The two remaining call sites are
 * promo-helpers.ts (whose FAQs feed the FAQPage JSON-LD on all 169 team pages)
 * and the HotelsCTA component, and neither can pull that dependency chain in.
 * This module imports nothing, so anything may import it.
 *
 * THE RULE IS SOUND-BASED, NOT SPELLING-BASED, because a vowel-letter test does
 * not survive the real corpus:
 *   UCLA, UConn, USF, Utah   vowel LETTER, consonant "yoo" sound  -> "a"
 *   NC State                 consonant LETTER, vowel "en" sound   -> "an"
 *   76ers, 49ers             spoken "seventy", "forty"            -> "a"
 *   8 Ball                   spoken "eight"                       -> "an"
 * It is a heuristic sized to the names these corpora hold and the shapes new
 * ones are likely to take, not to all of English.
 */

// Letters whose spoken name opens with a vowel sound (F is "eff", N is "en").
// U is deliberately absent: spoken "yoo", so an initialism opening U takes "a".
const VOWEL_SOUND_LETTERS = new Set(['A', 'E', 'F', 'H', 'I', 'L', 'M', 'N', 'O', 'R', 'S', 'X']);

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const TEENS = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/**
 * The FIRST SPOKEN WORD of a run of digits. Only the first word matters, so
 * there is no need to spell the whole number: "76ers" is "seventy-sixers" and
 * the article is decided by "seventy" alone.
 *
 * Numbers are grouped in threes from the right, so the leading group decides
 * the opening word: 800 opens "eight" (hundred), 1976 opens "one" (thousand).
 */
function firstSpokenWord(digits: string): string {
  const lead = digits.length % 3 === 0 ? digits.slice(0, 3) : digits.slice(0, digits.length % 3);
  if (lead.length === 3) return ONES[Number(lead[0])];        // "eight" hundred
  if (lead.length === 2) {
    const n = Number(lead);
    return n < 10 ? ONES[n] : n < 20 ? TEENS[n - 10] : TENS[Number(lead[0])];
  }
  return ONES[Number(lead)];
}

// "eight", "eighteen", "eighty" and "eleven" are the only number words opening
// with a vowel SOUND. "one" is excluded on purpose: it opens /w/, so "a 1-0
// win", never "an 1-0 win".
const NUMBER_WORD_TAKES_AN = /^(eight|eleven)/;

/** "a" or "an" for `name`. Sound-based; see the note above. */
export function indefiniteArticleFor(name: string): 'a' | 'an' {
  const first = name.trim().split(/\s+/)[0] ?? '';

  // Numeric-leading names are spoken, not spelled. Checked before the letter
  // rules, which would otherwise strip the digits off "76ers" and decide on
  // "ers".
  const digits = first.match(/^\d+/);
  if (digits) return NUMBER_WORD_TAKES_AN.test(firstSpokenWord(digits[0])) ? 'an' : 'a';

  const letters = first.replace(/[^A-Za-z]/g, '');
  if (!letters) return 'a';

  // Initialism ("NC State", "D.C. United", "BYU", "TCU"): the first letter is
  // read by its spoken name, not as a vowel or consonant glyph.
  if (letters.length >= 2 && letters === letters.toUpperCase()) {
    return VOWEL_SOUND_LETTERS.has(letters[0]) ? 'an' : 'a';
  }

  // "Utah", "Union", "Utica": U before a consonant is the "yoo" sound, as is a
  // leading "Eu". Both take "a".
  if (/^u[^aeiou]/i.test(letters) || /^eu/i.test(letters)) return 'a';

  return /^[aeiou]/i.test(letters) ? 'an' : 'a';
}
