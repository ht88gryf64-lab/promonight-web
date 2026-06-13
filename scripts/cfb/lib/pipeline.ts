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

const PARSER_SYSTEM = `You are a college-football SCHEDULE PARSER. Extract the 2026 regular-season schedule for one school as precise structured rows.

ANTI-HALLUCINATION RULES (hard):
- Today is 2026-06-12. Many kickoff times and TV networks are NOT announced this far out. If a time or network is not officially announced, output "TBD" — NEVER invent, infer, or carry over a prior year.
- For any kickoff time you DO report, store the timezone it is stated in (kickoff_tz: "ET"/"CT"/"MT"/"PT"). Never convert. If unsure of the tz, use the home venue's local tz.
- 'source' (the URL you actually read) and 'confidence' are REQUIRED on every row.
- Do NOT output conference-game status or week numbers — those are computed downstream by rule, not by you. (They are not in your output schema; do not try.)
- Use the web_search tool: prefer the official athletics site, then Wikipedia ("2026 <school> football team"), then ESPN.`;

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

export async function parseSchoolSchedule(school: CfbSchoolConfig): Promise<{ games: ParsedGame[]; usd: number }> {
  const user = `Extract the 2026 regular-season football schedule for the ${school.name}.
school_id (echo back): ${school.id}
Begin by web-searching the official athletics site (${school.officialDomain}) 2026 football schedule, then cross-check Wikipedia.`;
  let res = await extract({ system: PARSER_SYSTEM, user, returnTool: parserReturnTool, model: HAIKU, maxTokens: 6000 });
  if (!res.data?.games?.length) {
    // Sonnet fallback (build spec: Haiku with Sonnet fallback).
    const s = await extract({ system: PARSER_SYSTEM, user, returnTool: parserReturnTool, model: SONNET, maxTokens: 6000 });
    res = { data: s.data, usd: res.usd + s.usd, stop: s.stop };
  }
  const rows: ParsedGame[] = (res.data?.games ?? []).map((g: any) => ({
    date: String(g.date),
    homeTeam: slugifySchool(g.home_team),
    awayTeam: slugifySchool(g.away_team),
    neutralSite: Boolean(g.neutral_site),
    venue: String(g.venue ?? ''),
    kickoffTime: String(g.kickoff_time ?? 'TBD'),
    kickoffTz: String(g.kickoff_tz ?? school.venueTz),
    tvNetwork: String(g.tv_network ?? 'TBD'),
    tvConfirmed: Boolean(g.tv_confirmed),
    source: String(g.source ?? ''),
    confidence: ['HIGH', 'MEDIUM', 'LOW', 'NF'].includes(g.confidence) ? g.confidence : 'LOW',
  }));
  return { games: rows, usd: res.usd };
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
