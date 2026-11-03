#!/usr/bin/env node
// Builds the MLS bracket fixtures, in the document shape the pipeline writes
// to postseasonBrackets/MLS_2026 (the contract of 2026-11-03), from the
// real 2025 MLS postseason as ESPN served it: the month scoreboards captured
// by the MLS G0 audit (audit-archive/mls-postseason-g0/espn-mls/raw). No
// 2026 MLS document exists yet, so the 2025 results are mapped onto 2026
// keys and moved forward 364 days (52 weeks, so every weekday holds). Scores,
// shootouts, hosts, kickoff times and the order of events are ESPN's. No
// result is typed by hand; seeds are the 2025 conference ranks (st25.json).
//
//   node src/lib/postseason/__fixtures__/generate-mls-2026.cjs [ESPN_RAW_DIR]
//
// Four states, each the bracket as it stood at one instant:
//   early        Wild Card set, nothing played (2026-10-20T12:00Z)
//   round-one    Wild Card done, Round One part played (2026-11-02T12:00Z)
//   semis-done   Conference Semifinals done, Conference Finals ahead (2026-11-25T12:00Z)
//   final        MLS Cup played (2026-12-07T12:00Z)
const fs = require('node:fs');
const path = require('node:path');

const RAW = process.argv[2] || '/Users/mattkovalik/promonight/audit-archive/mls-postseason-g0/espn-mls/raw';
const OUT = __dirname;
const SHIFT_MS = 364 * 24 * 60 * 60 * 1000;

const SLUG = {
  CHI: 'chicago-fire', ORL: 'orlando-city', POR: 'portland-timbers', RSL: 'real-salt-lake', MIA: 'inter-miami', NSH: 'nashville-sc',
  PHI: 'philadelphia-union', VAN: 'vancouver-whitecaps', DAL: 'fc-dallas', SD: 'san-diego-fc', CIN: 'fc-cincinnati', CLB: 'columbus-crew',
  MIN: 'minnesota-united', SEA: 'seattle-sounders', NYC: 'new-york-city-fc', CLT: 'charlotte-fc', LAFC: 'lafc', ATX: 'austin-fc',
};
// The home venue's time zone, for game.date (the venue's local date).
const ZONE = {
  CHI: 'America/Chicago', ORL: 'America/New_York', POR: 'America/Los_Angeles', RSL: 'America/Denver', MIA: 'America/New_York', NSH: 'America/Chicago',
  PHI: 'America/New_York', VAN: 'America/Vancouver', DAL: 'America/Chicago', SD: 'America/Los_Angeles', CIN: 'America/New_York', CLB: 'America/New_York',
  MIN: 'America/Chicago', SEA: 'America/Los_Angeles', NYC: 'America/New_York', CLT: 'America/New_York', LAFC: 'America/Los_Angeles', ATX: 'America/Chicago',
};

// Seeds: the 2025 conference ranks.
function seeds() {
  const st = JSON.parse(fs.readFileSync(path.join(RAW, 'st25.json'), 'utf8'));
  const out = {};
  for (const c of st.children) {
    const conf = /Eastern/.test(c.name) ? 'East' : 'West';
    for (const e of c.standings.entries) {
      const r = e.stats.find((s) => s.name === 'rank');
      if (r && r.value <= 9) out[e.team.abbreviation] = { conf, seed: r.value };
    }
  }
  return out;
}

const ROUND = {
  'wild-card': { round: 'wild_card', roundLabel: 'Wild Card', shortLabel: 'Wild Card', bestOf: 1 },
  'round-one': { round: 'round_one', roundLabel: 'Round One', shortLabel: 'Round One', bestOf: 3 },
  semifinals: { round: 'conference_semifinals', roundLabel: 'Conference Semifinals', shortLabel: 'Conf. Semifinals', bestOf: 1 },
  final: { round: 'conference_finals', roundLabel: 'Conference Finals', shortLabel: 'Conf. Final', bestOf: 1 },
  cup: { round: 'mls_cup', roundLabel: 'MLS Cup', shortLabel: 'MLS Cup', bestOf: 1 },
};

function events() {
  const out = [];
  for (const f of ['sb_202510.json', 'sb_202511.json', 'sb_202512.json']) {
    const d = JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8'));
    for (const e of d.events) {
      const slug = e.season && e.season.slug;
      if (!slug || slug === 'regular-season') continue;
      const m = /^(eastern|western)-conference-playoffs---(wild-card|round-one|semifinals|final)$/.exec(slug);
      const kind = slug === 'mls-cup' ? 'cup' : m ? m[2] : null;
      if (!kind) continue;
      const c = e.competitions[0];
      const home = c.competitors.find((x) => x.homeAway === 'home');
      const away = c.competitors.find((x) => x.homeAway === 'away');
      out.push({
        id: e.id,
        kind,
        conf: m ? (m[1] === 'eastern' ? 'East' : 'West') : null,
        start: Date.parse(e.date),
        status: c.status.type.name,
        home: home.team.abbreviation,
        away: away.team.abbreviation,
        homeScore: Number(home.score),
        awayScore: Number(away.score),
        homeShootout: home.shootoutScore ?? null,
        awayShootout: away.shootoutScore ?? null,
        winner: home.winner ? home.team.abbreviation : away.winner ? away.team.abbreviation : null,
      });
    }
  }
  return out.sort((a, b) => a.start - b.start || (a.id < b.id ? -1 : 1));
}

const iso = (ms) => new Date(ms).toISOString().replace(/\.000Z$/, 'Z');
function localDate(ms, zone) {
  const p = {};
  for (const x of new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(ms))) p[x.type] = x.value;
  return `${p.year}-${p.month}-${p.day}`;
}

function build(cutoff2025, name, note) {
  const S = seeds();
  const evs = events();
  const done = (e) => e.status !== 'STATUS_CANCELED' && e.status !== 'STATUS_SCHEDULED' && e.start + 3 * 3600e3 <= cutoff2025;
  const winnerOf = new Map();
  const series = [];

  const slot = (abbr) => ({ slug: SLUG[abbr], seed: S[abbr].seed });
  const ph = (key, cands) => ({ placeholder: `Winner of ${key}`, seed: null, feederSeriesKey: key, candidates: cands && cands.every(Boolean) ? cands.map((a) => SLUG[a]) : null });

  function makeSeries(def, key, conf, hi, lo, evList, opts = {}) {
    const games = [];
    let wh = 0;
    let wl = 0;
    const hiAbbr = typeof hi === 'string' ? hi : null;
    const loAbbr = typeof lo === 'string' ? lo : null;
    let n = 0;
    for (const e of evList) {
      n += 1;
      // A Game 3 ESPN later canceled was a scheduled game until the series
      // was decided; once it is, the row is omitted (below), as the pipeline does.
      const decided = Math.max(wh, wl) >= Math.ceil(def.bestOf / 2);
      // An unneeded Game 3 is omitted as soon as the series is decided.
      if (decided) continue;
      const fin = done(e);
      // A row whose other side is not known yet is the placeholder's.
      const homeSide = e.home === hiAbbr ? 'higher' : loAbbr === null || e.home === loAbbr ? 'lower' : null;
      const loName = loAbbr ? SLUG[loAbbr] : lo.placeholder;
      const g = {
        gameNumber: n,
        gameId: e.id,
        date: localDate(e.start + SHIFT_MS, ZONE[e.home]),
        start: iso(e.start + SHIFT_MS),
        startTimeTBD: false,
        home: homeSide === 'higher' ? SLUG[hiAbbr] : loName,
        away: homeSide === 'higher' ? loName : SLUG[hiAbbr],
        homeSide,
        status: fin ? 'final' : 'scheduled',
        homeScore: fin ? e.homeScore : null,
        awayScore: fin ? e.awayScore : null,
        winnerSide: null,
        ifNecessary: def.bestOf === 3 && n === 3,
        decidedBy: null,
        homeShootout: null,
        awayShootout: null,
      };
      if (fin) {
        g.winnerSide = e.winner === hiAbbr ? 'higher' : 'lower';
        g.decidedBy = e.status === 'STATUS_FINAL_PEN' ? 'penalties' : e.status === 'STATUS_FINAL_AET' ? 'extra_time' : 'regulation';
        if (g.decidedBy === 'penalties') {
          g.homeShootout = e.homeShootout;
          g.awayShootout = e.awayShootout;
        }
        if (g.winnerSide === 'higher') wh += 1;
        else wl += 1;
      }
      games.push(g);
    }
    const need = Math.ceil(def.bestOf / 2);
    const status = wh >= need || wl >= need ? 'final' : games.some((g) => g.status === 'final') ? 'live' : 'upcoming';
    const winner = wh >= need ? hiAbbr : wl >= need ? loAbbr : null;
    if (winner) winnerOf.set(key, winner);
    series.push({
      round: def.round,
      roundLabel: def.roundLabel,
      shortLabel: def.shortLabel,
      seriesKey: key,
      conference: conf,
      bestOf: def.bestOf,
      higher: hiAbbr ? slot(hiAbbr) : hi,
      lower: loAbbr ? slot(loAbbr) : lo,
      wins: { higher: wh, lower: wl },
      status,
      winner: winner ? SLUG[winner] : null,
      games,
      ...opts,
    });
  }

  const has = (e, a, b) => (e.home === a && e.away === b) || (e.home === b && e.away === a);
  const byConf = (conf) => Object.keys(S).filter((a) => S[a].conf === conf).sort((a, b) => S[a].seed - S[b].seed);

  for (const [conf, P] of [['East', 'E'], ['West', 'W']]) {
    const s = byConf(conf);
    const at = (seed) => s.find((a) => S[a].seed === seed);
    // Wild Card, 8 v 9, at the 8 seed.
    const wc = evs.filter((e) => e.kind === 'wild-card' && e.conf === conf);
    makeSeries(ROUND['wild-card'], `${P}-WC`, conf, at(8), at(9), wc);
    // Round One. The 1 seed meets the Wild Card winner.
    const wcWinner = winnerOf.get(`${P}-WC`) ?? null;
    const r1 = (hi, lo) => evs.filter((e) => e.kind === 'round-one' && e.conf === conf && (lo ? has(e, hi, lo) : e.home === hi || e.away === hi));
    // Before the Wild Card is played its winner is unknown, but the 1 seed's
    // three dates are on ESPN: they are the rows naming the 1 seed. The other
    // side is the Wild Card winner, read here from the real result, and written
    // as the placeholder until the Wild Card is final in this state.
    const realWc = evs.find((e) => e.kind === 'wild-card' && e.conf === conf).winner;
    const one = r1(at(1), realWc);
    if (wcWinner) makeSeries(ROUND['round-one'], `${P}-R1-1`, conf, at(1), wcWinner, one);
    else makeSeries(ROUND['round-one'], `${P}-R1-1`, conf, at(1), ph(`${P}-WC`, [at(8), at(9)]), one);
    makeSeries(ROUND['round-one'], `${P}-R1-2`, conf, at(2), at(7), r1(at(2), at(7)));
    makeSeries(ROUND['round-one'], `${P}-R1-3`, conf, at(3), at(6), r1(at(3), at(6)));
    makeSeries(ROUND['round-one'], `${P}-R1-4`, conf, at(4), at(5), r1(at(4), at(5)));
    // Conference Semifinals: A = R1-1 v R1-4, B = R1-2 v R1-3, at the better seed.
    for (const [k, a, b] of [['A', '1', '4'], ['B', '2', '3']]) {
      const wa = winnerOf.get(`${P}-R1-${a}`);
      const wb = winnerOf.get(`${P}-R1-${b}`);
      const key = `${P}-SF-${k}`;
      if (wa && wb) {
        const [hi, lo] = S[wa].seed < S[wb].seed ? [wa, wb] : [wb, wa];
        makeSeries(ROUND.semifinals, key, conf, hi, lo, evs.filter((e) => e.kind === 'semifinals' && has(e, hi, lo)));
      } else {
        makeSeries(ROUND.semifinals, key, conf, ph(`${P}-R1-${a}`, null), ph(`${P}-R1-${b}`, null), []);
      }
    }
    // Conference Final.
    const fa = winnerOf.get(`${P}-SF-A`);
    const fb = winnerOf.get(`${P}-SF-B`);
    if (fa && fb) {
      const ev = evs.filter((e) => e.kind === 'final' && has(e, fa, fb));
      // The host comes from ESPN, never from the seed.
      const host = ev[0].home;
      const other = host === fa ? fb : fa;
      makeSeries(ROUND.final, `${P}-CF`, conf, host, other, ev);
    } else {
      makeSeries(ROUND.final, `${P}-CF`, conf, ph(`${P}-SF-A`, null), ph(`${P}-SF-B`, null), []);
    }
  }
  // MLS Cup, hosted by the better record (ESPN's host).
  const ce = winnerOf.get('E-CF');
  const cw = winnerOf.get('W-CF');
  if (ce && cw) {
    const ev = evs.filter((e) => e.kind === 'cup');
    const host = ev[0].home;
    makeSeries(ROUND.cup, 'CUP', null, host, host === ce ? cw : ce, ev);
  } else {
    makeSeries(ROUND.cup, 'CUP', null, ph('E-CF', null), ph('W-CF', null), []);
  }

  const lastFinal = Math.max(0, ...series.flatMap((s) => s.games.filter((g) => g.status === 'final').map((g) => Date.parse(g.start))));
  const changed = lastFinal ? lastFinal + 150 * 60e3 : cutoff2025 + SHIFT_MS - 6 * 3600e3;
  const doc = {
    league: 'MLS',
    season: 2026,
    writerVersion: 3,
    unplaced: null,
    seeds: { file: 'mls-2026.json', authoredBy: 'Fixture Author', authoredOn: '2026-11-03' },
    bracketSha256: 'f1x7ure0000000000000000000000000000000000000000000000000000000001',
    source: { kind: 'espn', urls: ['https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard'] },
    runId: `${name}-fixture-run`,
    operatorLog: [],
    validatedSeedSha256: 'f1x7ure0000000000000000000000000000000000000000000000000000000002',
    lastChangedAt: { __firestoreTimestamp: new Date(changed).toISOString() },
    lastRevalidatedSha256: 'f1x7ure0000000000000000000000000000000000000000000000000000000001',
    revalidationPending: null,
    lastFetchedAt: { __firestoreTimestamp: new Date(cutoff2025 + SHIFT_MS - 60e3).toISOString() },
    series,
  };
  const file = path.join(OUT, `MLS_2026.${name}.json`);
  fs.writeFileSync(file, JSON.stringify(doc, null, 1) + '\n');
  console.log(file, '|', note, '|', series.map((s) => `${s.seriesKey}:${s.status}${s.wins.higher + s.wins.lower ? ` ${s.wins.higher}-${s.wins.lower}` : ''}`).join(' '));
}

build(Date.parse('2025-10-21T12:00:00Z'), 'early', 'Wild Card set, nothing played');
build(Date.parse('2025-11-03T12:00:00Z'), 'round-one', 'Round One part played');
build(Date.parse('2025-11-26T12:00:00Z'), 'semis-done', 'semifinals done');
build(Date.parse('2025-12-08T12:00:00Z'), 'final', 'MLS Cup played');
