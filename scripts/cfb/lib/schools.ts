// Phase 1 scope: the 4 spike schools ONLY. (No expansion to the 25-anchor list.)

export interface CfbSchoolConfig {
  id: string;
  name: string;
  shortName: string;
  officialDomain: string; // for the verify stage's home-school re-fetch
  venueTz: string; // IANA tz of the home venue — kickoff.tz for home games
  conference2026: string;
}

export const PHASE1_SCHOOLS: CfbSchoolConfig[] = [
  { id: 'tennessee', name: 'Tennessee Volunteers', shortName: 'Tennessee', officialDomain: 'utsports.com', venueTz: 'America/New_York', conference2026: 'SEC' },
  { id: 'kansas-state', name: 'Kansas State Wildcats', shortName: 'Kansas State', officialDomain: 'kstatesports.com', venueTz: 'America/Chicago', conference2026: 'Big 12' },
  { id: 'notre-dame', name: 'Notre Dame Fighting Irish', shortName: 'Notre Dame', officialDomain: 'fightingirish.com', venueTz: 'America/New_York', conference2026: 'Independent' },
  { id: 'boise-state', name: 'Boise State Broncos', shortName: 'Boise State', officialDomain: 'broncosports.com', venueTz: 'America/Boise', conference2026: 'Pac-12' },
];

// ── KNOWN-BAD FIXTURES (documented in audit/cfb-stream-spike.md verify pass) ──
// Used by run-phase1 to prove each guard fires on the exact bad data the spike
// caught — deterministic, no API. This is the honest gate: if a guard does NOT
// fire here, the build is broken.

// Guard #1 — Boise's 6 systematically +2h kickoffs (all originally rated HIGH).
// parser = the wrong value; correct = the verify pass's independent value.
export const BOISE_KICKOFF_FIXTURE: { game: string; date: string; parser: { time: string; tz: string }; correct: { time: string; tz: string } }[] = [
  { game: 'at Oregon', date: '2026-09-05', parser: { time: '3:30 PM', tz: 'MT' }, correct: { time: '1:30 PM', tz: 'MT' } },
  { game: 'vs Memphis', date: '2026-09-12', parser: { time: '6:00 PM', tz: 'MT' }, correct: { time: '4:00 PM', tz: 'MT' } },
  { game: 'vs South Dakota', date: '2026-09-19', parser: { time: '10:00 PM', tz: 'MT' }, correct: { time: '8:00 PM', tz: 'MT' } },
  { game: 'at Colorado State', date: '2026-11-07', parser: { time: '6:00 PM', tz: 'MT' }, correct: { time: '4:00 PM', tz: 'MT' } },
  { game: 'vs Oregon State', date: '2026-11-14', parser: { time: '6:00 PM', tz: 'MT' }, correct: { time: '4:00 PM', tz: 'MT' } },
  { game: 'vs San Diego State', date: '2026-11-21', parser: { time: '9:30 PM', tz: 'MT' }, correct: { time: '7:30 PM', tz: 'MT' } },
];

// Guard #2 — Notre Dame schedule. `extractorWeek` is the spike extractor's
// (off-by-one after the bye); `homeTeam`/`awayTeam` drive the conferenceGame
// rule. ND is independent → every conferenceGame must gate to null, even the
// North Carolina game the extractor falsely flagged conferenceGame=yes.
export const ND_SCHEDULE_FIXTURE: { date: string; homeTeam: string; awayTeam: string; extractorWeek: number; extractorConferenceGame: boolean | null }[] = [
  { date: '2026-09-06', homeTeam: 'wisconsin', awayTeam: 'notre-dame', extractorWeek: 1, extractorConferenceGame: false },
  { date: '2026-09-12', homeTeam: 'notre-dame', awayTeam: 'rice', extractorWeek: 2, extractorConferenceGame: false },
  { date: '2026-09-19', homeTeam: 'notre-dame', awayTeam: 'michigan-state', extractorWeek: 3, extractorConferenceGame: false },
  { date: '2026-09-26', homeTeam: 'purdue', awayTeam: 'notre-dame', extractorWeek: 4, extractorConferenceGame: false },
  { date: '2026-10-03', homeTeam: 'north-carolina', awayTeam: 'notre-dame', extractorWeek: 5, extractorConferenceGame: true }, // <-- the false flag
  { date: '2026-10-10', homeTeam: 'notre-dame', awayTeam: 'stanford', extractorWeek: 6, extractorConferenceGame: false },
  { date: '2026-10-17', homeTeam: 'byu', awayTeam: 'notre-dame', extractorWeek: 7, extractorConferenceGame: false },
  { date: '2026-10-31', homeTeam: 'navy', awayTeam: 'notre-dame', extractorWeek: 8, extractorConferenceGame: false }, // (neutral; bye was 10-24)
  { date: '2026-11-07', homeTeam: 'notre-dame', awayTeam: 'miami', extractorWeek: 10, extractorConferenceGame: false }, // <-- off-by-one (should be 9)
  { date: '2026-11-14', homeTeam: 'notre-dame', awayTeam: 'boston-college', extractorWeek: 11, extractorConferenceGame: false },
  { date: '2026-11-21', homeTeam: 'notre-dame', awayTeam: 'smu', extractorWeek: 12, extractorConferenceGame: false },
  { date: '2026-11-28', homeTeam: 'syracuse', awayTeam: 'notre-dame', extractorWeek: 13, extractorConferenceGame: false },
];

// Guard #3 — rivalry conflations the verify pass caught.
export const RIVALRY_FIXTURE: { name: string; trophy: string | null; conflatedOriginYear: number | null; correctSeriesStart: number; correctTrophyYear: number | null }[] = [
  { name: 'Milk Can (Boise State–Fresno State)', trophy: 'Milk Can', conflatedOriginYear: 1977, correctSeriesStart: 1977, correctTrophyYear: 2005 },
  { name: "Governor's Trophy (Boise State–Idaho)", trophy: "Governor's Trophy", conflatedOriginYear: 1971, correctSeriesStart: 1971, correctTrophyYear: 2001 },
];

// Guard #4 — fabrication. The Dooley-Fulmer "trophy" had a single (wrong) source.
export const FABRICATION_FIXTURE = {
  claim: 'Tennessee–Vanderbilt "Dooley-Fulmer Trophy"',
  sources: ['https://en.wikipedia.org/wiki/Tennessee%E2%80%93Vanderbilt_football_rivalry'], // single domain
};

// Guard #5 — mis-citation. Correct TN/Texas noon kickoff, but cited to the stale
// MAY designations URL that does not carry the (June 10) time. citedCarriesValue
// is determined live by fetching the URL; encoded here as the known answer for
// the deterministic proof, and re-checked live in run-phase1.
export const MISCITATION_FIXTURE = {
  value: 'Texas at Tennessee kickoff 12:00 PM ET',
  citedUrl: 'https://utsports.com/news/2026/5/5/2026-football-game-designations-announced',
  authoritativeUrl: 'https://utsports.com/news/2026/6/10/football-tv-windows-texas-game-time-announced',
};
