import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { venueLocalKickoff } from '../cfb/kickoff';
import { renderedKickoff } from '../cfb/metadata';
import { sportsEventStartDate } from '../cfb/rivalry-jsonld';
import type { MatchupPage } from '../cfb/matchups';

// cfbGames.kickoff.tz is the label of whichever school's site parsed the row.
// Tennessee vs Texas at Neyland is stored "11:00 AM CT" (parsed from
// texassports.com). The verify stage corroborated that INSTANT (label read
// through the pipeline's IANA map: CT = America/Chicago), so the display reads
// the same instant and re-expresses it in the venue's zone. Never a blind
// relabel, never a conversion of a TBD.

const k = (time: string, tz: string, tbd = false) => ({ time, tz, tbd, windowFlex: null });
const g = (over: Record<string, unknown>) => ({ date: '2026-09-26', verified: true, kickoff: k('11:00 AM', 'CT'), ...over });

describe('venueLocalKickoff', () => {
  test('Tennessee vs Texas: 11:00 AM CT stored, Knoxville renders 12:00 PM ET', () => {
    const r = venueLocalKickoff(g({}), 'America/New_York');
    assert.equal(r.display, '12:00 PM ET');
    assert.equal(r.verified, true);
    assert.equal(r.iso, '2026-09-26T12:00:00-04:00');
    assert.equal(r.converted, true);
  });

  test('a label already in the venue zone is unchanged', () => {
    const r = venueLocalKickoff(g({ kickoff: k('3:30 PM', 'ET') }), 'America/New_York');
    assert.equal(r.display, '3:30 PM ET');
    assert.equal(r.converted, false);
  });

  test('Phoenix is not Denver: a CT label at Arizona Stadium in September lands on MST', () => {
    // Arizona vs Northern Illinois, stored 9:30 PM CT from niuhuskies.com.
    const r = venueLocalKickoff(g({ date: '2026-09-19', kickoff: k('9:30 PM', 'CT') }), 'America/Phoenix');
    assert.equal(r.display, '7:30 PM MST');
    assert.equal(r.iso, '2026-09-19T19:30:00-07:00');
  });

  test('neutral site: Notre Dame vs Wisconsin at Lambeau, 7:30 PM ET stored, renders 6:30 PM CT', () => {
    const r = venueLocalKickoff(g({ date: '2026-09-06', kickoff: k('7:30 PM', 'ET') }), 'America/Chicago');
    assert.equal(r.display, '6:30 PM CT');
  });

  test('Boise is Mountain: a PT label from San Diego State renders one hour later', () => {
    const r = venueLocalKickoff(g({ date: '2026-11-21', kickoff: k('6:30 PM', 'PT') }), 'America/Boise');
    assert.equal(r.display, '7:30 PM MT');
  });

  test('Hawaii: UNLV at Hawaii is stored 7:00 PM PT and kicks off at 4:00 PM HST', () => {
    const r = venueLocalKickoff(g({ date: '2026-09-05', kickoff: k('7:00 PM', 'PT') }), 'Pacific/Honolulu');
    assert.equal(r.display, '4:00 PM HST');
    assert.equal(r.iso, '2026-09-05T16:00:00-10:00');
  });

  test('after DST ends the offsets move together', () => {
    const r = venueLocalKickoff(g({ date: '2026-11-27', kickoff: k('9:00 p.m.', 'ET') }), 'America/Denver');
    assert.equal(r.display, '7:00 PM MT');
    assert.equal(r.iso, '2026-11-27T19:00:00-07:00');
  });

  test('a TBD is never converted', () => {
    for (const kick of [k('TBD', 'TBD', true), k('TBD', 'CT', false), k('', 'ET', false), k('7:30 PM', 'CT', true)]) {
      const r = venueLocalKickoff(g({ kickoff: kick }), 'America/New_York');
      assert.equal(r.display, 'Kickoff TBA');
      assert.equal(r.verified, false);
      assert.equal(r.iso, null);
      assert.equal(r.converted, false);
    }
  });

  test('an unverified time is withheld, converted or not', () => {
    const r = venueLocalKickoff(g({ verified: false }), 'America/New_York');
    assert.equal(r.display, 'Kickoff TBA');
    assert.equal(r.verified, false);
  });

  test('no venue zone: the stored label is shown as-is, nothing is converted', () => {
    const r = venueLocalKickoff(g({}), null);
    assert.equal(r.display, '11:00 AM CT');
    assert.equal(r.verified, true);
    assert.equal(r.converted, false);
  });

  test('an unknown label cannot fix the instant, so it is shown as stored', () => {
    const r = venueLocalKickoff(g({ kickoff: k('7:30 PM', 'TBD') }), 'America/New_York');
    assert.equal(r.display, '7:30 PM');
    assert.equal(r.converted, false);
  });

  test('the impossible-AM guard applies to the CONVERTED time', () => {
    // 3:00 AM ET stored would be impossible; so is a conversion landing there.
    const r = venueLocalKickoff(g({ kickoff: k('3:00 AM', 'ET') }), 'America/New_York');
    assert.equal(r.display, 'Kickoff TBA');
  });
});

describe('the matchup family reads the same converter', () => {
  const game = (over: Record<string, unknown> = {}) =>
    ({ date: '2026-09-26', verified: true, kickoff: k('11:00 AM', 'CT'), ...over }) as unknown as NonNullable<MatchupPage['game']>;

  test('renderedKickoff with a venue zone renders venue-local', () => {
    assert.equal(renderedKickoff(game(), 'America/New_York'), '12:00 PM ET');
  });
  test('renderedKickoff without a zone keeps the stored label (the pre-existing contract)', () => {
    assert.equal(renderedKickoff(game()), '11:00 AM CT');
  });
  test('sportsEventStartDate with a venue zone carries the venue offset', () => {
    assert.equal(sportsEventStartDate(game(), 'America/New_York'), '2026-09-26T12:00:00-04:00');
  });
  test('sportsEventStartDate without a zone is unchanged', () => {
    assert.equal(sportsEventStartDate(game()), '2026-09-26T11:00:00-05:00');
  });
});
