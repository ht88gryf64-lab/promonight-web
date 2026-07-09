/* eslint-disable no-console */
// FIX 3 (deterministic, harness-confirmed second source).
//
// Replaces the agent-found 2nd source (nondeterministic; Haiku fabricated junk
// when forced) with a CODE-based corroboration the HARNESS runs:
//   - Selection rule (deterministic, not agent choice): parser source is an
//     official athletics site  -> corroborate against Wikipedia. parser source
//     IS Wikipedia -> no independent code-fetchable 2nd source -> stay flagged.
//   - The harness fetches the corroborating source in code, parses the game's
//     schedule row, and FACT-MATCHES the kickoff value (constraint #2 — not
//     mere page presence).
//   - INDEPENDENCE (constraint #1): en.wikipedia.org is an independent primary
//     source, not a mirror/syndication of an official athletics site. We reject
//     a candidate whose domain equals the parser's, or that is a known
//     Wikipedia-mirror host.
//   - NO FETCHABLE INDEPENDENT SOURCE -> STAY FLAGGED (constraint #3). Never
//     relax this to inflate verified. robots.txt respected (plain GET; blocked
//     -> no value -> flagged).

import { domainOf, toUtcMinutes } from './guards';
import type { CfbSchoolConfig } from './schools';

const MONTHS: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
};
const MONTH_RE = '(?:January|February|March|April|May|June|July|August|September|October|November|December)';

// Known Wikipedia mirror/scrape hosts — a "second domain" that just republishes
// Wikipedia is the SAME source. Reject these as non-independent.
const WIKI_MIRRORS = ['wikipedia.org', 'wikiwand.com', 'dbpedia.org', 'fandom.com', 'wikimedia.org', 'everybodywiki.com'];

const strip = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/&#?\w+;/g, ' ').replace(/\s+/g, ' ').trim();
// SEARCH (not anchored) for a "Month DD" — Wikipedia's opener date cell is
// polluted with day-of-week + template debris ("Sunday …}]]}'>September 6"), so
// requiring the whole cell to EQUAL the date dropped the neutral-site row.
const isDate = (c: string) => new RegExp(MONTH_RE + '\\s+\\d{1,2}', 'i').test(c);
const isTime = (c: string) => /\d{1,2}:\d{2}\s*[ap]\.?\s*m\.?/i.test(c.trim());

function toIso(dateCell: string, season: number): string | null {
  const m = dateCell.match(new RegExp('(' + MONTH_RE + ')\\s+(\\d{1,2})', 'i'));
  if (!m) return null;
  const mm = MONTHS[m[1].toLowerCase()];
  return mm ? `${season}-${mm}-${String(parseInt(m[2], 10)).padStart(2, '0')}` : null;
}

export interface WikiSchedule {
  url: string;
  fetched: boolean;
  byDate: Map<string, { time: string; opp: string; ha: 'H' | 'A' }>;
}

// A school config carrying enough to locate its Wikipedia team page. The Phase-2
// config supplies the resolved `wikiTeamPage` title (robust for App State etc.);
// the frozen Phase-1 config has only `name`, so we fall back to constructing it.
type WikiTarget = { name: string; wikiTeamPage?: string | null };

/** Deterministic: fetch + parse the school's Wikipedia 2026 schedule into a
 *  date-keyed map. Same page -> same parse. Style/script/comment blocks are
 *  stripped first — an inline <style> in the OPENER's first cell (the neutral-site
 *  Shamrock Series row) was clobbering the date cell and dropping the row. */
export async function fetchWikiSchedule(school: WikiTarget, season = 2026): Promise<WikiSchedule> {
  const url = school.wikiTeamPage
    ? `https://en.wikipedia.org/wiki/${encodeURIComponent(school.wikiTeamPage.replace(/ /g, '_'))}`
    : `https://en.wikipedia.org/wiki/${season}_${school.name.replace(/ /g, '_')}_football_team`;
  const byDate = new Map<string, { time: string; opp: string; ha: 'H' | 'A' }>();
  // Wikipedia rate-limits User-Agent-less requests under load — set a UA and retry
  // transient failures (429/5xx/network) so a blip does not falsely strand a school
  // as no-2nd-source. A genuine 404 (the not-yet-created G5 pages) returns immediately.
  const UA = 'cfb-phase2/1.0 (research; mkovalik32@gmail.com)';
  let html = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (r.ok) { html = await r.text(); break; }
      if (r.status === 404) return { url, fetched: false, byDate };
    } catch { /* transient — retry */ }
    await new Promise((res) => setTimeout(res, 400 * (attempt + 1)));
  }
  if (!html) return { url, fetched: false, byDate };
  // Remove <style>/<script>/comment BLOCKS (content included) so their text does
  // not leak into a table cell and defeat the date-cell match.
  html = html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  for (const [, rowHtml] of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((m) => strip(m[1]));
    const di = cells.findIndex(isDate);
    if (di < 0) continue;
    const oppCell = (cells[di + 2] || '').trim();
    if (!oppCell || /(Stadium|Field|Dome|Coliseum|Arena)/.test(oppCell)) continue; // di+2 must be opponent, not venue
    const iso = toIso(cells[di], season);
    if (!iso) continue;
    const timeCell = (cells[di + 1] || '').trim();
    const ha: 'H' | 'A' = /^at\b/i.test(oppCell) ? 'A' : 'H';
    const opp = oppCell.replace(/^(at|vs\.?)\s+/i, '').replace(/\bNo\.\s*\d+\s*/i, '').replace(/\s*[*#†‡].*$/, '').trim();
    if (!byDate.has(iso)) byDate.set(iso, { time: isTime(timeCell) ? timeCell.toLowerCase() : 'TBD', opp, ha });
  }
  return { url, fetched: html.length > 0, byDate };
}

export type CorroborationVerdict = 'verified' | 'downgraded' | 'flagged-for-human';

export interface CorroborationResult {
  verdict: CorroborationVerdict;
  /** The independent 2nd-source URL(s) the harness confirmed against. */
  sourcesChecked: string[];
  /** Which field the second domain independently carried (constraint #2). */
  fieldConfirmed: string | null;
  flags: string[];
  /** Friction bucket for the breakdown. */
  bucket: 'verified' | 'value-conflict' | 'honest-tbd' | 'no-2nd-source' | 'unconfirmed';
}

/** Deterministic corroboration of one parsed game against the Wikipedia schedule. */
export function corroborate(
  game: { date: string; source: string; homeSchoolId: string; awaySchoolId: string; kickoff: { time: string; tz: string; tbd: boolean } },
  wiki: WikiSchedule,
  school: { venueTz: string },
): CorroborationResult {
  const parserDom = domainOf(game.source);
  const WIKI_DOM = 'en.wikipedia.org';

  // Selection rule + independence: if the parser already cited Wikipedia (or a
  // Wikipedia mirror), there is no independent code-fetchable 2nd source here.
  if (parserDom === WIKI_DOM || WIKI_MIRRORS.some((m) => parserDom.endsWith(m))) {
    return { verdict: 'flagged-for-human', sourcesChecked: [], fieldConfirmed: null, bucket: 'no-2nd-source', flags: [`parser source domain is ${parserDom} (Wikipedia/mirror); no independent code-fetchable 2nd domain — staying flagged (constraint 3)`] };
  }
  if (!wiki.fetched) {
    return { verdict: 'flagged-for-human', sourcesChecked: [], fieldConfirmed: null, bucket: 'no-2nd-source', flags: ['Wikipedia corroborator not fetchable in code — staying flagged (constraint 3)'] };
  }
  const w = wiki.byDate.get(game.date);
  if (!w) {
    return { verdict: 'flagged-for-human', sourcesChecked: [], fieldConfirmed: null, bucket: 'no-2nd-source', flags: [`game (${game.date}) not found on the independent Wikipedia schedule — no 2nd domain to confirm (constraint 3)`] };
  }

  const pTbd = game.kickoff.tbd || /tbd|tba/i.test(game.kickoff.time);
  const wTbd = /tbd|tba/i.test(w.time);

  if (wTbd && pTbd) {
    return { verdict: 'flagged-for-human', sourcesChecked: [wiki.url], fieldConfirmed: null, bucket: 'honest-tbd', flags: [`honest-TBD: kickoff genuinely unannounced on both the parser source and Wikipedia (${game.date})`] };
  }
  if (wTbd && !pTbd) {
    return { verdict: 'flagged-for-human', sourcesChecked: [wiki.url], fieldConfirmed: null, bucket: 'unconfirmed', flags: [`parser asserts kickoff "${game.kickoff.time}" but the independent Wikipedia source has no announced time — unconfirmed, staying flagged`] };
  }
  if (!wTbd && pTbd) {
    return { verdict: 'flagged-for-human', sourcesChecked: [wiki.url], fieldConfirmed: null, bucket: 'unconfirmed', flags: [`Wikipedia has an announced kickoff (${w.time}) the parser left TBD — staying flagged`] };
  }

  // Both have announced times — FACT-MATCH the kickoff value. Wikipedia lists a
  // school's schedule in the SCHOOL's home venue tz.
  const pUtc = toUtcMinutes(game.date, game.kickoff.time, game.kickoff.tz);
  const wUtc = toUtcMinutes(game.date, w.time, school.venueTz);
  if (pUtc === null || wUtc === null) {
    return { verdict: 'flagged-for-human', sourcesChecked: [wiki.url], fieldConfirmed: null, bucket: 'unconfirmed', flags: ['could not normalize a kickoff for fact-match'] };
  }
  const deltaH = Math.abs(pUtc - wUtc) / 60;
  if (deltaH < 0.25) {
    return { verdict: 'verified', sourcesChecked: [wiki.url], fieldConfirmed: 'kickoff', bucket: 'verified', flags: [`kickoff "${game.kickoff.time}" independently confirmed on ${WIKI_DOM}`] };
  }
  return { verdict: 'downgraded', sourcesChecked: [wiki.url], fieldConfirmed: null, bucket: 'value-conflict', flags: [`kickoff conflict ${deltaH.toFixed(1)}h: parser="${game.kickoff.time} ${game.kickoff.tz}" vs Wikipedia="${w.time}" (${school.venueTz})`] };
}
