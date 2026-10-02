// What the playoffs pages say, derived from a mapped Bracket. PURE.
//
// Every string a reader sees about a series or a game is built here, from the
// bracket, the web's own team records and the web's own venue names. Nothing
// here knows a league's format: round order is the order the document lists
// its rounds, labels are the document's labels, and a slot the document does
// not fill with a club renders the document's own text.
//
// The output is plain data with no functions and no class instances, so it
// can be handed to a client component as it is.
import type { PromoType } from '../types';
import type { Bracket, BracketGame, BracketSeries, BracketSlot, GameStatus, PostseasonLeague, Side } from './types';

export const EASTERN = 'America/New_York';

/** The fields of a team record the playoffs pages use. */
export interface ClubInfo {
  id: string;
  city: string;
  name: string;
  abbreviation: string;
  sportSlug: string;
  primaryColor: string;
}

/** A host club's park: the web's venue name for the club, and its venue page
 *  when the web has one that is above the indexing floor. */
export interface ParkInfo {
  name: string;
  page: ParkPage | null;
}

export interface ParkPage {
  href: string;
  buildingSlug: string;
  buildingName: string;
}

export interface SlotView {
  kind: 'club' | 'placeholder';
  seed: number | null;
  /** Club nickname, or the slot's placeholder text. */
  label: string;
  /** City and nickname for a club. The placeholder text otherwise. */
  fullName: string;
  abbreviation: string | null;
  teamId: string | null;
  teamHref: string | null;
  color: string | null;
  wins: number;
  leads: boolean;
  won: boolean;
}

/**
 * A postseason promotion at a game, as the page shows it: the item and its
 * kind, nothing that says which row it came from.
 */
export interface GamePromo {
  title: string;
  type: PromoType;
  icon: string;
}

/**
 * A postseason promotion row as the reader hands it in, keyed the way the
 * pipeline keys it: the series and the game number, which name one game of
 * one bracket. The series key never leaves this module; it is looked up
 * here and dropped.
 */
export interface PromoRow extends GamePromo {
  seriesKey: string;
  gameNumber: number;
}

export interface GameView {
  gameNumber: number;
  title: string;
  /** "Tue, Sep 29 · 4:08 PM ET", "Sat, Oct 3 · Time TBD" or "Date TBD". */
  when: string;
  /** The day the game is listed under, in ET when the time is known. */
  day: string | null;
  sortKey: string;
  state: GameStatus;
  stateLabel: string;
  ifNecessary: boolean;
  /** "HOU 5, CWS 3" for a final game. Null otherwise: a score in progress is
   *  stale the moment the page is cached, so it is not shown. */
  result: string | null;
  /** "White Sox at Astros". A placeholder side shows its own text. */
  matchup: string;
  hostTeamId: string | null;
  hostName: string | null;
  park: string | null;
  /** The park's page on this site. Null when there is none: the name then
   *  renders as plain text. */
  parkPage: ParkPage | null;
  /** The postseason promotion at this game, when the host has published one. */
  promo: GamePromo | null;
}

export interface SeriesView {
  /** The page's own id for the series: its round key and its position in
   *  that round, "division_series-2". This is what markup and analytics
   *  carry. The pipeline's series key ("AL-DS-B") is not in the view. */
  id: string;
  round: string;
  roundLabel: string;
  conference: string | null;
  formatLabel: string;
  higher: SlotView;
  lower: SlotView;
  status: BracketSeries['status'];
  /** "ATL leads 1-0", "Series tied 1-1", "NYY won 2-1". Null at 0-0. */
  scoreLine: string | null;
  /** "Game 2 live" while a game is in progress. */
  liveLabel: string | null;
  /** "Game 2 · Wed, Sep 30 · 3:08 PM ET". Null when nothing is scheduled. */
  nextLabel: string | null;
  /** The one line the hub shows for the series. */
  headline: string;
  next: GameView | null;
  games: GameView[];
}

export interface RoundView {
  key: string;
  label: string;
  shortLabel: string | null;
  /** Series grouped by the document's conference value, in document order.
   *  One group with a null name when the round has no conferences. */
  groups: { conference: string | null; series: SeriesView[] }[];
}

export type PhaseView =
  | { kind: 'active'; roundKey: string; roundLabel: string }
  | { kind: 'concluded'; championTeamId: string; championName: string; championHref: string; summary: string };

export interface LeagueView {
  league: PostseasonLeague;
  season: number;
  /** "Sep 29, 1:42 PM ET". Null when the document carries no stamp. */
  updatedLabel: string | null;
  /** The same moment as an ISO instant, for machine-readable dates. */
  updatedAt: string | null;
  phase: PhaseView;
  rounds: RoundView[];
  /** Scheduled games with a known host, soonest first. */
  homeGames: HomeGameView[];
}

export interface HomeGameView {
  key: string;
  league: PostseasonLeague;
  /** The page's id for the series the game belongs to. */
  seriesId: string;
  roundLabel: string;
  matchup: string;
  gameTitle: string;
  when: string;
  day: string;
  sortKey: string;
  ifNecessary: boolean;
  /** The game has a start instant and its time is not TBD. A game without
   *  one is listed with "Time TBD" (its `when`); a game with no date never
   *  reaches this list (Matt's ruling, 2026-10-02). */
  timed: boolean;
  /** The start instant of a timed game; null otherwise. A game past it is
   *  no longer upcoming, whatever the feed still says. */
  startsAt: string | null;
  /** An untimed game dated before today that the bracket still lists as
   *  scheduled in a series not yet decided. The playoffs lists keep it
   *  (Matt's ruling, 2026-10-02: a "Time TBD" game leaves only when the
   *  bracket shows it played or its series over, never by the clock); the
   *  venue pages leave it out, as before. */
  pastDate: boolean;
  hostTeamId: string;
  hostName: string;
  park: string | null;
  parkPage: ParkPage | null;
  promo: GamePromo | null;
}

/** The home games list as the pages show it: a short list first, and the
 *  rest of the week behind "Show all". */
export interface HomeGamesWindow {
  primary: HomeGameView[];
  rest: HomeGameView[];
}

/** The short list covers today and the two days after it, Eastern. */
export const HOME_GAMES_DAYS = 3;
/** And never more than this many rows. */
export const HOME_GAMES_ROWS = 8;
/** "Show all" reveals the rest of this many days, today included. */
export const HOME_GAMES_WEEK_DAYS = 7;

// ---- Time, always Eastern ----
function parts(d: Date, zone: string, opts: Intl.DateTimeFormatOptions): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat('en-US', { timeZone: zone, ...opts }).formatToParts(d)) {
    out[p.type] = p.value;
  }
  return out;
}

/** "4:08 PM ET". Assembled from parts so the spacing is an ordinary space on
 *  every runtime (newer ICU builds put a narrow no-break space before PM). */
export function easternTime(iso: string): string {
  const p = parts(new Date(iso), EASTERN, { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${p.hour}:${p.minute} ${p.dayPeriod} ET`;
}

/** "Tue, Sep 29", the Eastern calendar day of an instant. */
export function easternDay(iso: string): string {
  const p = parts(new Date(iso), EASTERN, { weekday: 'short', month: 'short', day: 'numeric' });
  return `${p.weekday}, ${p.month} ${p.day}`;
}

/** YYYY-MM-DD of an instant on the Eastern calendar. */
export function easternYmd(d: Date): string {
  const p = parts(d, EASTERN, { year: 'numeric', month: '2-digit', day: '2-digit' });
  return `${p.year}-${p.month}-${p.day}`;
}

/** "20:08", the Eastern wall clock of an instant on a 24 hour dial. Used
 *  only to order games. An 8 PM Eastern start is stored as the NEXT day in
 *  UTC, so ordering on the stored instant puts it after an untimed game of
 *  its own day; ordering on the Eastern day and clock does not. */
function easternClock(iso: string): string {
  const p = parts(new Date(iso), EASTERN, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return `${p.hour}:${p.minute}`;
}

/** "Sat, Oct 3" from a stored YYYY-MM-DD, with no zone arithmetic at all. */
export function calendarDay(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const p = parts(new Date(Date.UTC(y, m - 1, d, 12)), 'UTC', { weekday: 'short', month: 'short', day: 'numeric' });
  return `${p.weekday}, ${p.month} ${p.day}`;
}

/** "Sep 29, 1:42 PM ET", for the bracket's own change stamp. */
export function easternStamp(iso: string): string {
  const p = parts(new Date(iso), EASTERN, { month: 'short', day: 'numeric' });
  return `${p.month} ${p.day}, ${easternTime(iso)}`;
}

function addDaysYmd(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n, 12)).toISOString().slice(0, 10);
}

// ---- Slots ----
function slotView(
  slot: BracketSlot,
  which: Side,
  series: BracketSeries,
  clubs: ReadonlyMap<string, ClubInfo>,
  league: PostseasonLeague,
): SlotView | null {
  const wins = series.wins[which];
  const other = series.wins[which === 'higher' ? 'lower' : 'higher'];
  if (slot.kind === 'club') {
    const club = clubs.get(slot.slug);
    // A club the web has no record of cannot be named. The caller treats this
    // as an unavailable bracket, never as a slug turned into a title.
    if (!club) return null;
    return {
      kind: 'club',
      seed: slot.seed,
      label: club.name,
      fullName: `${club.city} ${club.name}`,
      abbreviation: club.abbreviation,
      teamId: club.id,
      teamHref: `/${club.sportSlug}/${club.id}`,
      color: club.primaryColor,
      wins,
      leads: wins > other,
      won: series.winnerSide === which,
    };
  }
  const label = placeholderText(slot, clubs, league);
  return {
    kind: 'placeholder',
    seed: slot.seed,
    label,
    fullName: label,
    abbreviation: null,
    teamId: null,
    teamHref: null,
    color: null,
    wins,
    leads: false,
    won: false,
  };
}

/**
 * The text of a slot no club fills yet.
 *
 * When the slot carries two candidate clubs (the mapper sets them only when
 * the stored slot also names its feeder series), the text is composed from
 * the web's own team names: "Yankees / Red Sox winner". An older document
 * without candidates names the slot by the feed's abbreviations ("NYY/BOS");
 * each is read through the web's own team records (the abbreviation of a
 * club in this bracket) into the same text, and a code no record carries
 * makes the whole slot "TBD", never the raw code (Matt's ruling, 2026-10-02;
 * the feed and the web disagree on two MLB clubs, ATH/OAK and AZ/ARI, which
 * therefore read "TBD"). Any other label is shown verbatim. The feeder series
 * key is never text.
 */
export function placeholderText(
  slot: Extract<BracketSlot, { kind: 'placeholder' }>,
  clubs: ReadonlyMap<string, ClubInfo>,
  /** The bracket's league: a code is read among that league's clubs only
   *  ("ATL" is the Braves in MLB and the Dream in the WNBA). */
  league?: PostseasonLeague,
): string {
  if (slot.candidates) {
    const a = clubs.get(slot.candidates[0]);
    const b = clubs.get(slot.candidates[1]);
    if (a && b) return `${a.name} / ${b.name} winner`;
  }
  if (slot.label !== 'TBD' && FEED_ABBREVIATIONS.test(slot.label)) {
    const all = [...clubs.values()].filter((c) => !league || c.sportSlug === league.toLowerCase());
    const names = slot.label.split('/').map((code) => {
      const hit = all.filter((c) => c.abbreviation === code);
      return hit.length === 1 ? hit[0].name : null;
    });
    if (names.some((n) => n === null)) return 'TBD';
    return names.length === 1 ? (names[0] as string) : `${names.join(' / ')} winner`;
  }
  return slot.label;
}

/** A label that is nothing but feed abbreviations: "NYY/BOS", "SD". */
export const FEED_ABBREVIATIONS = /^[A-Z]{2,4}(?:\/[A-Z]{2,4})*$/;

// ---- Games ----
const STATE_LABEL: Record<GameStatus, string> = {
  scheduled: 'Scheduled',
  live: 'Live',
  suspended: 'Suspended',
  postponed: 'Postponed',
  cancelled: 'Cancelled',
  final: 'Final',
};

/**
 * Is this game played only if the series is still undecided when it comes
 * up? Computed from the series, not read from the document: the document's
 * flag is the format's (any game past the clinch number), and it stays set
 * on a deciding game, which is certain to be played. Here a scheduled game
 * is conditional only while the leader could still clinch before it, even
 * by winning every game in between.
 */
export function isConditional(s: Pick<BracketSeries, 'bestOf' | 'wins' | 'status'>, g: Pick<BracketGame, 'gameNumber' | 'status'>): boolean {
  if (g.status !== 'scheduled' || s.status === 'final') return false;
  const clinch = Math.ceil(s.bestOf / 2);
  const played = s.wins.higher + s.wins.lower;
  const lead = Math.max(s.wins.higher, s.wins.lower);
  const before = Math.max(0, g.gameNumber - 1 - played);
  return lead + before >= clinch;
}

function gameView(
  g: BracketGame,
  s: BracketSeries,
  higher: SlotView,
  lower: SlotView,
  parks: ReadonlyMap<string, ParkInfo>,
  promos: ReadonlyMap<string, GamePromo>,
): GameView {
  const timed = !g.startTimeTBD && g.start !== null;
  // The day a game is listed under. With a known time it is the Eastern day
  // of the instant, so the day and the time shown beside it agree. With no
  // time it is the stored date: the feed's start for an untimed game is a
  // filler instant (03:33 or 07:33 UTC) and says nothing about the day.
  const dayYmd = timed ? easternYmd(new Date(g.start as string)) : g.date;
  let when: string;
  if (timed) when = `${easternDay(g.start as string)} · ${easternTime(g.start as string)}`;
  else if (g.date) when = `${calendarDay(g.date)} · Time TBD`;
  else when = 'Date TBD';

  const home = g.homeSide === null ? null : g.homeSide === 'higher' ? higher : lower;
  const away = g.homeSide === null ? null : g.homeSide === 'higher' ? lower : higher;
  const host = home && home.kind === 'club' ? home : null;

  let result: string | null = null;
  if (g.status === 'final' && home && away && g.homeScore !== null && g.awayScore !== null) {
    const homeName = home.abbreviation ?? home.label;
    const awayName = away.abbreviation ?? away.label;
    // Winner first, the way a line score is read aloud.
    result =
      g.homeScore >= g.awayScore
        ? `${homeName} ${g.homeScore}, ${awayName} ${g.awayScore}`
        : `${awayName} ${g.awayScore}, ${homeName} ${g.homeScore}`;
  }

  const conditional = isConditional(s, g);
  const waiting = conditional;
  const park = host && host.teamId ? parks.get(host.teamId) ?? null : null;
  return {
    gameNumber: g.gameNumber,
    title: `Game ${g.gameNumber}`,
    when,
    day: dayYmd,
    sortKey: timed ? `${dayYmd}T${easternClock(g.start as string)}` : `${g.date ?? '9999-99-99'}T99`,
    state: g.status,
    stateLabel: waiting ? 'If necessary' : STATE_LABEL[g.status],
    ifNecessary: conditional,
    result,
    matchup: home && away ? `${away.label} at ${home.label}` : `${lower.label} vs ${higher.label}`,
    hostTeamId: host ? host.teamId : null,
    hostName: host ? host.label : null,
    park: park ? park.name : null,
    parkPage: park ? park.page : null,
    promo: promos.get(promoKey(s.seriesKey, g.gameNumber)) ?? null,
  };
}

const promoKey = (seriesKey: string, gameNumber: number) => `${seriesKey}#${gameNumber}`;

/** "2-2-1" from the rows themselves: who hosts game 1, 2, 3 and so on. Null
 *  unless every game of the series is listed with a confirmed host, and null
 *  when one side hosts them all. */
function homePattern(s: BracketSeries): string | null {
  if (s.games.length !== s.bestOf) return null;
  const runs: number[] = [];
  let prev: Side | null = null;
  for (let i = 0; i < s.games.length; i++) {
    const g = s.games[i];
    if (g.gameNumber !== i + 1 || g.homeSide === null) return null;
    if (g.homeSide === prev) runs[runs.length - 1] += 1;
    else runs.push(1);
    prev = g.homeSide;
  }
  return runs.length > 1 ? runs.join('-') : null;
}

// ---- Series ----
function seriesView(
  s: BracketSeries,
  id: string,
  league: PostseasonLeague,
  clubs: ReadonlyMap<string, ClubInfo>,
  parks: ReadonlyMap<string, ParkInfo>,
  promos: ReadonlyMap<string, GamePromo>,
): SeriesView | null {
  const higher = slotView(s.higher, 'higher', s, clubs, league);
  const lower = slotView(s.lower, 'lower', s, clubs, league);
  if (!higher || !lower) return null;
  const games = s.games.map((g) => gameView(g, s, higher, lower, parks, promos));

  let scoreLine: string | null = null;
  const hi = s.wins.higher;
  const lo = s.wins.lower;
  if (s.status === 'final' && s.winnerSide) {
    const w = s.winnerSide === 'higher' ? higher : lower;
    scoreLine = `${w.abbreviation ?? w.label} won ${Math.max(hi, lo)}-${Math.min(hi, lo)}`;
  } else if (hi + lo > 0) {
    if (hi === lo) scoreLine = `Series tied ${hi}-${lo}`;
    else {
      const l = hi > lo ? higher : lower;
      scoreLine = `${l.abbreviation ?? l.label} leads ${Math.max(hi, lo)}-${Math.min(hi, lo)}`;
    }
  }

  // Nothing is "next" in a decided series, even when the feed still lists an
  // unplayed game under it.
  const open = s.status === 'final' ? [] : games.filter((g) => g.state !== 'final' && g.state !== 'cancelled');
  const inProgress = open.find((g) => g.state === 'live') ?? null;
  const next = inProgress ?? open[0] ?? null;
  const liveLabel = inProgress ? `${inProgress.title} live` : null;
  let nextLabel: string | null = null;
  if (next && next !== inProgress) {
    if (next.state === 'scheduled') nextLabel = `${next.title} · ${next.when}`;
    else nextLabel = `${next.title} · ${next.stateLabel}`;
  }

  const undecided = higher.kind === 'placeholder' || lower.kind === 'placeholder';
  const headline = liveLabel ?? scoreLine ?? nextLabel ?? (undecided ? 'Matchup to be decided' : 'No games listed');

  const pattern = homePattern(s);
  return {
    id,
    round: s.round,
    roundLabel: s.roundLabel,
    conference: s.conference,
    formatLabel: pattern ? `Best of ${s.bestOf} · ${pattern}` : `Best of ${s.bestOf}`,
    higher,
    lower,
    status: s.status,
    scoreLine,
    liveLabel,
    nextLabel,
    headline,
    next,
    games,
  };
}

// ---- The league ----
/**
 * The whole league page as data, or null when a club in the bracket has no
 * team record on the web (the caller treats that as a document it cannot
 * read, and throws).
 *
 * `now` decides only which scheduled games are still ahead. It is the render
 * time on the server, never the visitor's clock.
 */
export function buildLeagueView(
  bracket: Bracket,
  clubs: ReadonlyMap<string, ClubInfo>,
  parks: ReadonlyMap<string, ParkInfo>,
  now: Date,
  promoRows: readonly PromoRow[] = [],
): LeagueView | null {
  // One promotion per game. Two rows for one game that say the same thing
  // (a rescan can write a row twice under two ids) are one promotion. Two
  // that disagree are neither: the page has one line for the game, and
  // which row to prefer is not the web's call. Keyed on the series key here
  // and nowhere else.
  const promos = new Map<string, GamePromo>();
  const disputed = new Set<string>();
  for (const r of promoRows) {
    const k = promoKey(r.seriesKey, r.gameNumber);
    const seen = promos.get(k);
    if (!seen) promos.set(k, { title: r.title, type: r.type, icon: r.icon });
    else if (seen.title !== r.title || seen.type !== r.type) disputed.add(k);
  }
  for (const k of disputed) promos.delete(k);

  const rounds: RoundView[] = [];
  const byKey = new Map<string, RoundView>();
  const flat: SeriesView[] = [];
  const ids = seriesIds(bracket);
  for (const s of bracket.series) {
    const v = seriesView(s, ids.get(s.seriesKey) as string, bracket.league, clubs, parks, promos);
    if (!v) return null;
    flat.push(v);
    let round = byKey.get(s.round);
    if (!round) {
      round = { key: s.round, label: s.roundLabel, shortLabel: s.shortLabel, groups: [] };
      byKey.set(s.round, round);
      rounds.push(round);
    }
    let group = round.groups.find((g) => g.conference === s.conference);
    if (!group) {
      group = { conference: s.conference, series: [] };
      round.groups.push(group);
    }
    group.series.push(v);
  }

  const seriesOf = (r: RoundView) => r.groups.flatMap((g) => g.series);
  const last = rounds[rounds.length - 1];
  const lastSeries = seriesOf(last);
  const open = rounds.find((r) => seriesOf(r).some((s) => s.status !== 'final'));

  let phase: PhaseView;
  const decider = lastSeries.length === 1 ? lastSeries[0] : null;
  const champion = decider && decider.status === 'final' ? (decider.higher.won ? decider.higher : decider.lower.won ? decider.lower : null) : null;
  if (!open && champion && champion.teamId && champion.teamHref) {
    const hi = Math.max(decider!.higher.wins, decider!.lower.wins);
    const lo = Math.min(decider!.higher.wins, decider!.lower.wins);
    phase = {
      kind: 'concluded',
      championTeamId: champion.teamId,
      championName: champion.fullName,
      championHref: champion.teamHref,
      summary: `Won the ${last.label} ${hi}-${lo}`,
    };
  } else {
    const current = open ?? last;
    phase = { kind: 'active', roundKey: current.key, roundLabel: current.label };
  }

  const today = easternYmd(now);
  const homeGames: HomeGameView[] = [];
  flat.forEach((s, i) => {
    if (s.status === 'final') return;
    const raw = bracket.series[i].games;
    for (const g of s.games) {
      if (g.state !== 'scheduled' || !g.hostTeamId || !g.hostName || !g.day) continue;
      const stored = raw.find((r) => r.gameNumber === g.gameNumber);
      const timed = !!stored && !stored.startTimeTBD && stored.start !== null;
      // A timed game dated before today is a row the feed has not caught up
      // on: not upcoming. An untimed one stays until the bracket says it was
      // played (it is then no longer 'scheduled') or its series is over.
      if (g.day < today && timed) continue;
      homeGames.push({
        key: `${bracket.league}-${s.id}-g${g.gameNumber}`,
        league: bracket.league,
        seriesId: s.id,
        roundLabel: s.roundLabel,
        matchup: g.matchup,
        gameTitle: g.title,
        when: g.when,
        day: g.day,
        sortKey: g.sortKey,
        ifNecessary: g.ifNecessary,
        timed,
        startsAt: stored && !stored.startTimeTBD ? stored.start : null,
        pastDate: !timed && g.day < today,
        hostTeamId: g.hostTeamId,
        hostName: g.hostName,
        promo: g.promo,
        park: g.park,
        parkPage: g.parkPage,
      });
    }
  });
  homeGames.sort(bySoonest);

  return {
    league: bracket.league,
    season: bracket.season,
    updatedLabel: bracket.lastChangedAt ? easternStamp(bracket.lastChangedAt) : null,
    updatedAt: bracket.lastChangedAt,
    phase,
    rounds,
    homeGames,
  };
}

/**
 * The page's id for each series, by the pipeline's series key: the round key
 * and the series' position in that round, in the document's order.
 * "AL-WC-B" is "wild_card-2". Server-side only; the view carries the id and
 * not the key.
 */
export function seriesIds(bracket: Bracket): Map<string, string> {
  const out = new Map<string, string>();
  const seen = new Map<string, number>();
  for (const s of bracket.series) {
    const n = (seen.get(s.round) ?? 0) + 1;
    seen.set(s.round, n);
    out.set(s.seriesKey, `${s.round}-${n}`);
  }
  return out;
}

/** The series of the round the league is playing now, for the hub card. */
export function currentRoundSeries(view: LeagueView): SeriesView[] {
  if (view.phase.kind !== 'active') return [];
  const key = view.phase.roundKey;
  const round = view.rounds.find((r) => r.key === key);
  return round ? round.groups.flatMap((g) => g.series) : [];
}

const bySoonest = (a: HomeGameView, b: HomeGameView) =>
  a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : a.key < b.key ? -1 : a.key > b.key ? 1 : 0;

/**
 * The home games of one league, or of several merged, as the pages list
 * them.
 *
 * `primary` is the short list: games on the next three Eastern calendar
 * days, today included, and no more than eight of them; with none in those
 * days, the soonest eight of the week. `rest` is every other game in the
 * next seven days, which "Show N more games" reveals. A "Time TBD" game
 * dated earlier stays until the bracket shows it played or its series over.
 * One row per game: a game that arrives twice is listed once.
 */
export function homeGamesWindow(views: readonly LeagueView[], now: Date): HomeGamesWindow {
  const today = easternYmd(now);
  const shortEnd = addDaysYmd(today, HOME_GAMES_DAYS - 1);
  const weekEnd = addDaysYmd(today, HOME_GAMES_WEEK_DAYS - 1);
  const seen = new Set<string>();
  const week: HomeGameView[] = [];
  for (const g of views.flatMap((v) => v.homeGames)) {
    // Every game with a known date is listed; an untimed one reads "Time
    // TBD" and stays, whatever its date, until the bracket shows it played or
    // its series over (buildLeagueView). A game with no date never reaches
    // the list.
    if ((g.day < today && g.timed) || g.day > weekEnd) continue;
    // Started, though the feed still lists it as scheduled: not upcoming.
    if (g.startsAt && Date.parse(g.startsAt) < now.getTime()) continue;
    if (seen.has(g.key)) continue;
    seen.add(g.key);
    week.push(g);
  }
  week.sort(bySoonest);
  // Nothing in three days: the short list is the soonest of the week, so the
  // empty state shows only when there is no game at all and never sits over
  // a "Show N more games" button.
  const soon = week.filter((g) => g.day <= shortEnd);
  const primary = (soon.length ? soon : week).slice(0, HOME_GAMES_ROWS);
  const shown = new Set(primary.map((g) => g.key));
  return { primary, rest: week.filter((g) => !shown.has(g.key)) };
}

/** Every club slug a bracket names, so the caller can look each one up. */
export function clubSlugs(bracket: Bracket): string[] {
  const out = new Set<string>();
  for (const s of bracket.series) {
    for (const slot of [s.higher, s.lower]) {
      if (slot.kind === 'club') out.add(slot.slug);
      else if (slot.candidates) for (const c of slot.candidates) out.add(c);
    }
  }
  return [...out];
}

/** The clubs that host at least one listed game, so parks are looked up for
 *  those and no others. */
export function hostSlugs(bracket: Bracket): string[] {
  const out = new Set<string>();
  for (const s of bracket.series) {
    for (const g of s.games) {
      if (g.homeSide === null) continue;
      const slot = s[g.homeSide];
      if (slot.kind === 'club') out.add(slot.slug);
    }
  }
  return [...out];
}
