/* eslint-disable no-console */
// Two extraction functions, deliberately kept apart:
//   parseSchoolSchedule  — the parser (Part B). Produces values.
//   blindVerifySchool    — the verify re-fetch (Part C). Receives ONLY a
//                          skeleton {date, homeTeam, awayTeam}. It is
//                          STRUCTURALLY prevented from seeing the parser's
//                          kickoff/tz/network/conference — those are not in its
//                          input type. The two meet only at the diff in
//                          run-phase1.ts.

import { extract, HAIKU, SONNET } from './anthropic';
import { slugifySchool } from '../../../src/lib/cfb/rules';
import { fetchMarkdown, type FirecrawlClient, type FetchResult } from './firecrawl-fetch';
import { normalizeSlug } from './schools-2026';
import type { CfbSchoolConfig } from './schools';

export interface ParsedGame {
  date: string;
  homeTeam: string; // slug
  awayTeam: string; // slug
  neutralSite: boolean;
  venue: string;
  kickoffTime: string;
  kickoffTz: string;
  tvNetwork: string;
  tvConfirmed: boolean;
  source: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NF';
}

const PARSER_SYSTEM = `You are a college-football SCHEDULE PARSER. You are given the RENDERED MARKDOWN of ONE school's OFFICIAL athletics-site 2026 football schedule page. Extract the 2026 regular-season schedule as precise structured rows FROM THE PROVIDED MARKDOWN ONLY.

ANTI-HALLUCINATION RULES (hard):
- Parse ONLY what the provided markdown shows. Do NOT use outside knowledge, do NOT invent games not present, do NOT web-search.
- Today is 2026-07-07. If a kickoff time or TV network is not present in the markdown, output "TBD" — never invent, infer, or carry over a prior year. (Many are legitimately unannounced this far out.)
- For any kickoff time present, store the timezone it is stated in (kickoff_tz: "ET"/"CT"/"MT"/"PT"). Never convert. If a time is present but its tz is unlabeled, use the home venue tz given in the prompt.
- Guard against a STALE-YEAR page: only extract the 2026 schedule. If the visible schedule is a prior season, return an empty games array.
- 'confidence' is REQUIRED per row (HIGH when the row is clearly on the page; lower when ambiguous). 'source' is set by the harness — do not worry about it.
- Do NOT output conference-game status or week numbers — those are computed downstream by rule, not by you.`;

const parserReturnTool = {
  name: 'return_schedule',
  description: 'Return the parsed 2026 schedule rows. Call exactly once when done.',
  input_schema: {
    type: 'object',
    properties: {
      school_id: { type: 'string' },
      games: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'YYYY-MM-DD' },
            home_team: { type: 'string', description: 'home school name' },
            away_team: { type: 'string', description: 'away school name' },
            neutral_site: { type: 'boolean' },
            venue: { type: 'string' },
            kickoff_time: { type: 'string', description: 'e.g. "7:30 PM" or "TBD"' },
            kickoff_tz: { type: 'string', description: 'ET/CT/MT/PT, or "TBD"' },
            tv_network: { type: 'string', description: 'or "TBD"' },
            tv_confirmed: { type: 'boolean' },
            source: { type: 'string', description: 'URL actually read' },
            confidence: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW', 'NF'] },
          },
          required: ['date', 'home_team', 'away_team', 'kickoff_time', 'kickoff_tz', 'tv_network', 'source', 'confidence'],
        },
      },
    },
    required: ['school_id', 'games'],
  },
};

// Minimal parse target — satisfied by BOTH the Phase-1 CfbSchoolConfig and the
// Phase-2 CfbSchoolConfig2026. officialScheduleUrl is optional (derived from the
// domain when absent) so the frozen Phase-1 config still works.
export interface ParseTarget {
  id: string;
  name: string;
  officialDomain: string;
  officialScheduleUrl?: string;
  venueTz: string;
}

export interface ParseOutcome {
  games: ParsedGame[];
  usd: number;
  fetch: { ok: boolean; url: string; reason?: string; charCount?: number };
}

/**
 * PART A source-independence fix: fetch the OFFICIAL athletics-site schedule page
 * via Firecrawl, then Haiku parses THAT markdown (no web_search). `source` is set
 * deterministically to the official URL — so the parser's domain is ALWAYS the
 * official site, which frees Wikipedia to be the independent code corroborator
 * (corroborate.ts) and collapses the Phase-1 "parser used Wikipedia" no-2nd-source
 * residue. opts.client / opts.fetchResult allow zero-credit dependency injection.
 */
export async function parseSchoolSchedule(
  school: ParseTarget,
  opts: { client?: FirecrawlClient; fetchResult?: FetchResult } = {},
): Promise<ParseOutcome> {
  const url = school.officialScheduleUrl || `https://${school.officialDomain}/sports/football/schedule`;
  const fetched = opts.fetchResult ?? (await fetchMarkdown(url, opts.client ? { client: opts.client } : {}));
  if (fetched.ok === false) return { games: [], usd: 0, fetch: { ok: false, url, reason: fetched.reason } };
  const md = fetched.markdown;

  const user = `Parse the 2026 football schedule for ${school.name} from THIS official athletics-site page markdown. Home venue timezone: ${school.venueTz} (use only to fill an unlabeled kickoff tz). Echo school_id "${school.id}".\n\n<official-markdown>\n${md.slice(0, 60000)}\n</official-markdown>`;

  let res = await extract({ system: PARSER_SYSTEM, user, returnTool: parserReturnTool, model: HAIKU, maxTokens: 6000, webSearch: false });
  if (!res.data?.games?.length) {
    // Sonnet fallback (build spec: Haiku with Sonnet fallback).
    const s = await extract({ system: PARSER_SYSTEM, user, returnTool: parserReturnTool, model: SONNET, maxTokens: 6000, webSearch: false });
    res = { data: s.data, usd: res.usd + s.usd, stop: s.stop };
  }
  const rows: ParsedGame[] = (res.data?.games ?? []).map((g: any) => ({
    date: String(g.date),
    homeTeam: normalizeSlug(slugifySchool(g.home_team)),
    awayTeam: normalizeSlug(slugifySchool(g.away_team)),
    neutralSite: Boolean(g.neutral_site),
    venue: String(g.venue ?? ''),
    kickoffTime: String(g.kickoff_time ?? 'TBD'),
    kickoffTz: String(g.kickoff_tz ?? school.venueTz),
    tvNetwork: String(g.tv_network ?? 'TBD'),
    tvConfirmed: Boolean(g.tv_confirmed),
    source: url, // DETERMINISTIC: the official URL fetched, not whatever the LLM echoes
    confidence: ['HIGH', 'MEDIUM', 'LOW', 'NF'].includes(g.confidence) ? g.confidence : 'LOW',
  }));
  return { games: rows, usd: res.usd, fetch: { ok: true, url, charCount: md.length } };
}

// ── BLIND VERIFY ─────────────────────────────────────────────────────────────
// Input is ONLY the skeleton. There is no field here for the parser's kickoff,
// tz, network, or conference. This is the structural isolation.
export interface VerifySkeletonGame {
  date: string;
  homeTeam: string; // slug
  awayTeam: string; // slug
}

export interface VerifyObservation {
  date: string;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string;
  kickoffTz: string;
  tvNetwork: string;
  conferenceGameAsRead: 'yes' | 'no' | 'unknown'; // what a source SAYS (feeds the derived-field guard)
  source: string;
  sources: string[]; // ALL distinct URLs consulted for this game (feeds the 2nd-source guard)
}

const VERIFY_SYSTEM = `You are an INDEPENDENT verifier for college-football kickoff data. You are given ONLY a list of games (date + the two teams). You have NOT been told any kickoff time, timezone, TV network, or conference status — produce them yourself from primary sources.

RULES:
- Today is 2026-06-12. For each game, independently find the kickoff time and TV network. Read the HOST (home) school's official athletics site AND at least one INDEPENDENT source — the Wikipedia "2026 <team> football team" page and/or ESPN, which carry full 2026 schedules with announced times and are reliably readable. Do NOT return "TBD" if a reputable independent source has the announced time; return "TBD" only when the time is genuinely not yet announced anywhere.
- 'sources' MUST list at least TWO DISTINCT source DOMAINS you actually read for the game (e.g. the official site AND en.wikipedia.org). Corroborate the date/opponent across two domains even when the kickoff is TBD. Two URLs on the SAME domain do not count as two.
- Report the kickoff timezone you actually read (kickoff_tz: ET/CT/MT/PT). Never convert.
- conference_game_as_read: report ONLY what a source explicitly states about whether it is a conference game ("yes"/"no"), else "unknown". (Do not reason about it yourself.)
- 'source' = the primary URL; 'sources' = all distinct domains read.
- Use web_search. Be precise; this is an audit.`;

const verifyReturnTool = {
  name: 'return_verification',
  description: 'Return independently-found kickoff/TV data per game. Call once when done.',
  input_schema: {
    type: 'object',
    properties: {
      games: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            date: { type: 'string' },
            home_team: { type: 'string' },
            away_team: { type: 'string' },
            kickoff_time: { type: 'string' },
            kickoff_tz: { type: 'string' },
            tv_network: { type: 'string' },
            conference_game_as_read: { type: 'string', enum: ['yes', 'no', 'unknown'] },
            source: { type: 'string', description: 'primary URL read' },
            sources: { type: 'array', items: { type: 'string' }, description: 'ALL distinct URLs you read for this game (official + Wikipedia + any other)' },
          },
          // NOTE: 'sources' is intentionally NOT required — forcing it made the
          // Haiku verifier fill it with non-URL junk ("(bad)" domains). It stays
          // optional/encouraged; reliable >=2-domain provenance needs a
          // deterministic code-based 2nd source (see report re-gate notes).
          required: ['date', 'home_team', 'away_team', 'kickoff_time', 'kickoff_tz', 'conference_game_as_read', 'source'],
        },
      },
    },
    required: ['games'],
  },
};

export async function blindVerifySchool(
  school: CfbSchoolConfig,
  skeleton: VerifySkeletonGame[],
): Promise<{ observations: VerifyObservation[]; usd: number }> {
  // Present ONLY date + matchup. No kickoff/tz/network/conference fields exist.
  const list = skeleton
    .map((g) => `- ${g.date}: ${g.awayTeam} at ${g.homeTeam}`)
    .join('\n');
  const user = `Independently verify kickoff times and TV networks for these ${school.name} 2026 games. You are NOT told the times — find them yourself.\n\n${list}\n\nFor each game, read the host school's official site AND an independent source (the Wikipedia "2026 ${school.shortName} football team" page and/or ESPN), and record at least two distinct domains in 'sources'.`;
  let res = await extract({ system: VERIFY_SYSTEM, user, returnTool: verifyReturnTool, model: HAIKU, maxTokens: 6000 });
  if (!res.data?.games?.length) {
    const s = await extract({ system: VERIFY_SYSTEM, user, returnTool: verifyReturnTool, model: SONNET, maxTokens: 6000 });
    res = { data: s.data, usd: res.usd + s.usd, stop: s.stop };
  }
  const obs: VerifyObservation[] = (res.data?.games ?? []).map((g: any) => ({
    date: String(g.date),
    homeTeam: slugifySchool(g.home_team),
    awayTeam: slugifySchool(g.away_team),
    kickoffTime: String(g.kickoff_time ?? 'TBD'),
    kickoffTz: String(g.kickoff_tz ?? school.venueTz),
    tvNetwork: String(g.tv_network ?? 'TBD'),
    conferenceGameAsRead: ['yes', 'no', 'unknown'].includes(g.conference_game_as_read) ? g.conference_game_as_read : 'unknown',
    source: String(g.source ?? ''),
    sources: Array.isArray(g.sources) ? g.sources.map(String) : [String(g.source ?? '')],
  }));
  return { observations: obs, usd: res.usd };
}
