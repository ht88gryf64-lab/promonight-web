/* eslint-disable no-console */
// The five anti-hallucination guards (build spec §4), as PURE deterministic
// functions. No network, no LLM — the LLM produces the data, these decide
// whether it can reach verified=true. Unit-testable on known-bad fixtures,
// which is how Part D proves each guard fires.

// ── Timezone (guard #1) ──────────────────────────────────────────────────────
// Boise: 6 kickoffs were +2h, all rated HIGH. Compare parser vs an independent
// observation by reducing BOTH (date, wall-time, tz) to an absolute UTC instant
// and diffing. A 2h error survives no tz expression.

export const IANA: Record<string, string> = {
  ET: 'America/New_York', ET_: 'America/New_York', EST: 'America/New_York', EDT: 'America/New_York',
  CT: 'America/Chicago', CST: 'America/Chicago', CDT: 'America/Chicago',
  MT: 'America/Denver', MST: 'America/Denver', MDT: 'America/Denver',
  PT: 'America/Los_Angeles', PST: 'America/Los_Angeles', PDT: 'America/Los_Angeles',
};

/** Offset (minutes from UTC) for an IANA zone on a given date, DST-correct. */
export function ianaOffsetMinutes(iana: string, date: string): number {
  const d = new Date(`${date}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: iana, timeZoneName: 'longOffset' }).formatToParts(d);
  const name = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+00:00';
  const m = name.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
  if (!m) return 0;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (parseInt(m[2], 10) * 60 + parseInt(m[3] ?? '0', 10));
}

function normTime(t: string): string {
  // Accept "13:30", "1:30 PM", "1:30 PM MT" -> "HH:MM" 24h, or "TBD".
  if (!t || /tbd|n\/?f|tba/i.test(t)) return 'TBD';
  const m = t.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (!m) return 'TBD';
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ap = (m[3] || '').toLowerCase();
  if (ap === 'pm' && h !== 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${min}`;
}

/** Absolute UTC minute-of-window for (date, wall-time, tz). null if TBD. */
export function toUtcMinutes(date: string, time: string, tz: string): number | null {
  const hhmm = normTime(time);
  if (hhmm === 'TBD') return null;
  const iana = IANA[(tz || '').toUpperCase().replace(/[^A-Z_/]/g, '')] ?? tz ?? 'America/New_York';
  const [h, mm] = hhmm.split(':').map(Number);
  const local = h * 60 + mm;
  const off = ianaOffsetMinutes(iana, date);
  return local - off; // utc = local - offset
}

export interface GuardResult {
  ok: boolean;
  flag?: string;
}

export function guardTimezone(
  date: string,
  parser: { time: string; tz: string },
  verify: { time: string; tz: string },
): GuardResult {
  const a = toUtcMinutes(date, parser.time, parser.tz);
  const b = toUtcMinutes(date, verify.time, verify.tz);
  if (a === null && b === null) return { ok: true }; // both TBD — agree
  if (a === null || b === null) {
    return { ok: false, flag: `kickoff presence mismatch: parser="${parser.time} ${parser.tz}" vs independent="${verify.time} ${verify.tz}"` };
  }
  const deltaMin = Math.abs(a - b);
  if (deltaMin < 15) return { ok: true };
  return {
    ok: false,
    flag: `kickoff mismatch ${(deltaMin / 60).toFixed(1)}h: parser="${parser.time} ${parser.tz}" vs independent="${verify.time} ${verify.tz}"`,
  };
}

// ── Derived fields (guard #2) ────────────────────────────────────────────────
// conferenceGame + week are computed by RULE; the guard re-asserts the rule and
// flags any stored value that disagrees (catches ND conferenceGame=yes and the
// bye double-count off-by-one). `independentConfRead` is what the blind verify
// extracted from a source — if a source claims conference but the rule says
// otherwise, the rule wins and we record that the gate prevented it.

export function guardDerivedFields(
  stored: { conferenceGame: boolean | null; week: number },
  ruleConferenceGame: boolean | null,
  ruleWeek: number,
  independentConfRead?: boolean | null,
): GuardResult {
  const flags: string[] = [];
  if (stored.conferenceGame !== ruleConferenceGame) {
    flags.push(`conferenceGame=${stored.conferenceGame} but rule says ${ruleConferenceGame}`);
  }
  if (stored.week !== ruleWeek) {
    flags.push(`week=${stored.week} but rule computes ${ruleWeek}`);
  }
  if (independentConfRead === true && ruleConferenceGame !== true) {
    flags.push(`a source asserted conferenceGame=true; rule overrides to ${ruleConferenceGame} (gate held)`);
  }
  return flags.length ? { ok: false, flag: flags.join('; ') } : { ok: true };
}

// ── Entity conflation (guard #3) ─────────────────────────────────────────────
// seriesStartYear must be a SEPARATE field from trophyCreatedYear. Flags a
// single conflated origin year (the spike: Milk Can 1977 series vs 2005 trophy;
// Governor's Trophy 1971 series vs 2001 trophy).

export function guardEntityConflation(rivalry: {
  trophy: string | null;
  seriesStartYear: number | null;
  trophyCreatedYear: number | null;
  conflatedOriginYear?: number | null; // set when the source gave a single year
}): GuardResult {
  if (rivalry.conflatedOriginYear != null) {
    return { ok: false, flag: `single originYear=${rivalry.conflatedOriginYear} conflates series-start with trophy-creation; split required` };
  }
  if (rivalry.trophy && rivalry.trophyCreatedYear == null) {
    return { ok: false, flag: `trophy "${rivalry.trophy}" present but trophyCreatedYear missing (split incomplete)` };
  }
  if (
    rivalry.trophy &&
    rivalry.seriesStartYear != null &&
    rivalry.trophyCreatedYear != null &&
    rivalry.seriesStartYear === rivalry.trophyCreatedYear
  ) {
    return { ok: false, flag: `seriesStartYear == trophyCreatedYear (${rivalry.seriesStartYear}) — likely conflation` };
  }
  return { ok: true };
}

// ── Second source / fabrication (guard #4) ───────────────────────────────────
// A claim needs >= 2 INDEPENDENT source domains. Single-source claims cannot
// reach verified=true (kills the Dooley-Fulmer fabrication, which had one bad
// source).

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function guardSecondSource(urls: (string | null | undefined)[]): GuardResult {
  const domains = new Set(urls.map((u) => domainOf(u || '')).filter(Boolean));
  if (domains.size >= 2) return { ok: true };
  return { ok: false, flag: `only ${domains.size} independent source domain(s) [${[...domains].join(', ')}]; need >= 2` };
}

// ── Mis-citation (guard #5) ──────────────────────────────────────────────────
// The stored source URL must actually carry the value (not a plausible adjacent
// URL). `citedSourceCarriesValue` is determined by independently fetching the
// stored URL and checking — see verify stage. null = could not check.

export function guardCitation(citedSourceCarriesValue: boolean | null): GuardResult {
  if (citedSourceCarriesValue === true) return { ok: true };
  if (citedSourceCarriesValue === false) return { ok: false, flag: `stored source does NOT carry the value (mis-citation)` };
  return { ok: false, flag: `citation unverifiable (cited URL not fetchable / value not found)` };
}

// ── Diff: parser vs blind-verify, applying guards 1,2,4,5 to a game ──────────
export interface GameGuardInput {
  date: string;
  parserKickoff: { time: string; tz: string };
  verifyKickoff: { time: string; tz: string };
  stored: { conferenceGame: boolean | null; week: number };
  ruleConferenceGame: boolean | null;
  ruleWeek: number;
  independentConfRead?: boolean | null;
  sourceUrls: (string | null | undefined)[];
  citedSourceCarriesValue: boolean | null;
}

export interface GameGuardOutcome {
  verdict: 'verified' | 'downgraded' | 'flagged-for-human';
  guards: { timezone: boolean; derivedFields: boolean; entityConflation: boolean; secondSource: boolean; citation: boolean };
  flags: string[];
}

export function diffGame(input: GameGuardInput): GameGuardOutcome {
  const tz = guardTimezone(input.date, input.parserKickoff, input.verifyKickoff);
  const df = guardDerivedFields(input.stored, input.ruleConferenceGame, input.ruleWeek, input.independentConfRead);
  const ss = guardSecondSource(input.sourceUrls);
  const cit = guardCitation(input.citedSourceCarriesValue);
  // entityConflation is rivalry-scoped, not per-game — always true here.
  const guards = { timezone: tz.ok, derivedFields: df.ok, entityConflation: true, secondSource: ss.ok, citation: cit.ok };
  const flags = [tz.flag, df.flag, ss.flag, cit.flag].filter((f): f is string => Boolean(f));
  const allOk = tz.ok && df.ok && ss.ok && cit.ok;
  // A hard data mismatch (timezone/derived) = downgraded (value wrong).
  // A provenance failure (second-source/citation) but matching values =
  // flagged-for-human (value may be right, trust not yet established).
  let verdict: GameGuardOutcome['verdict'];
  if (allOk) verdict = 'verified';
  else if (!tz.ok || !df.ok) verdict = 'downgraded';
  else verdict = 'flagged-for-human';
  return { verdict, guards, flags };
}
