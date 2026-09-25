// Text hygiene shared by the social RSS feed and its image cards.
//
// The web repo has no cite-tag sanitize guard of its own (the pipeline's guard
// runs at ingest), so model-written strings are stripped here before output:
// any <cite ...> opener and </cite> closer is removed, keeping the inner text.
// Characters XML 1.0 cannot carry (C0 controls other than tab/LF/CR, DEL,
// U+FFFE, U+FFFF, lone surrogates) are dropped, and all whitespace runs,
// including tabs and newlines, collapse to one space.

const CITE_OPEN = /<cite\b[^>]*>/gi;
const CITE_CLOSE = /<\/cite\s*>/gi;
// eslint-disable-next-line no-control-regex
const XML_INVALID = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

export function cleanText(value: unknown): string {
  if (typeof value !== 'string') return '';
  // Repeat until stable so a nested fragment like "<ci<cite>te>" cannot
  // reassemble into a tag after one pass.
  let text = value.replace(XML_INVALID, '');
  for (let prev = ''; prev !== text; ) {
    prev = text;
    text = text.replace(CITE_OPEN, '').replace(CITE_CLOSE, '');
  }
  return text
    .replace(/\s+/g, ' ')
    .trim();
}
