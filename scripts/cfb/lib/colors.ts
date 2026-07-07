/* eslint-disable no-console */
// Team colors (decision record: LOWEST-stakes, verify-gated, "don't over-harden").
// Wikipedia stores CFB colors in template-driven CSS, so a naive wikitext hex grab
// is unreliable (it picks up table/formatting colors). This reads the hex ONLY from
// the swatches in the program-page infobox "Colors" row — a color CONTEXT, not any
// stray hex — and proposes them. humanConfirmed:false always: the editorial pass
// confirms/fills colors for destination schools. Never trusted; null when unsure.

const UA = 'cfb-phase2/1.0 (research; mkovalik32@gmail.com)';

export interface ProposedColors {
  primary: string | null;
  secondary: string | null;
  humanConfirmed: false;
  source: string;
  proposedFrom: string;
  note?: string;
}

export interface ColorTarget {
  name: string;
  nick: string;
}

/** Best-effort proposed colors from the program page infobox "Colors" swatches. */
export async function resolveColors(school: ColorTarget): Promise<ProposedColors> {
  const title = `${school.name} ${school.nick} football`;
  const url = 'https://en.wikipedia.org/wiki/' + encodeURIComponent(title.replace(/ /g, '_'));
  let html = '';
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!r.ok) return { primary: null, secondary: null, humanConfirmed: false, source: url, proposedFrom: 'wiki-program-colors-row', note: `program page non-200 (${r.status})` };
    html = await r.text();
  } catch {
    return { primary: null, secondary: null, humanConfirmed: false, source: url, proposedFrom: 'wiki-program-colors-row', note: 'fetch-error' };
  }
  const ci = html.search(/<th[^>]*>\s*Colors?\s*<\/th>/i);
  if (ci < 0) return { primary: null, secondary: null, humanConfirmed: false, source: url, proposedFrom: 'wiki-program-colors-row', note: 'no Colors row' };
  const seg = html.slice(ci, ci + 1400);
  const hexes = [...new Set([...seg.matchAll(/background(?:-color)?:\s*#([0-9A-Fa-f]{6})/gi)].map((m) => '#' + m[1].toUpperCase()))];
  return {
    primary: hexes[0] || null,
    secondary: hexes[1] || null,
    humanConfirmed: false,
    source: url,
    proposedFrom: 'wiki-program-colors-row',
    note: hexes.length ? undefined : 'no swatch hex found — editorial fills',
  };
}
