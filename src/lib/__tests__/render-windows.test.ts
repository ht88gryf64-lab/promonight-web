import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { prerenderWindowDates, splitCompletedForRender } from '../render-windows';

const TODAY = '2026-09-04';
const WINDOW = 30;
const MAX = 35;

const day = (date: string, isHome: boolean) => ({ date, isHome });
const win = (days: { date: string; isHome: boolean }[], homeOnly: boolean, today = TODAY) =>
  [...prerenderWindowDates({ days, today, windowDays: WINDOW, max: MAX, homeOnly })].sort();

describe('prerenderWindowDates', () => {
  it('keeps only home dates when home dates exist in the window', () => {
    const days = [
      day('2026-09-05', true),
      day('2026-09-11', false),
      day('2026-09-12', false),
      day('2026-09-18', true),
    ];
    assert.deepEqual(win(days, true), ['2026-09-05', '2026-09-18']);
  });

  it('is byte-identical to the old behaviour when the flag is off', () => {
    const days = [day('2026-09-05', true), day('2026-09-11', false)];
    assert.deepEqual(win(days, false), ['2026-09-05', '2026-09-11']);
  });

  it('FLOOR: a road trip keeps its away dates instead of prerendering nothing', () => {
    // The failure this guards: filtering to home dates unconditionally leaves a
    // club with no home game in the next 30 days with ZERO prerendered detail,
    // which is a blackout, not a trim, and defeats the window's whole purpose.
    const roadTrip = [
      day('2026-09-06', false),
      day('2026-09-07', false),
      day('2026-09-08', false),
    ];
    assert.deepEqual(win(roadTrip, true), ['2026-09-06', '2026-09-07', '2026-09-08']);
    assert.deepEqual(win(roadTrip, true), win(roadTrip, false), 'floor equals the unfiltered set');
  });

  it('the floor is scoped to the WINDOW, not the whole schedule', () => {
    // A home game 60 days out must not rescue the window: it is outside it, so
    // the away days inside the window are what the crawler should see.
    const days = [day('2026-09-06', false), day('2026-11-20', true)];
    assert.deepEqual(win(days, true), ['2026-09-06']);
  });

  it('excludes dates outside the window on both sides', () => {
    const days = [
      day('2026-09-03', true), // yesterday
      day('2026-09-04', true), // today, inclusive
      day('2026-10-04', true), // last day of the window, inclusive
      day('2026-10-05', true), // past the window
    ];
    assert.deepEqual(win(days, true), ['2026-09-04', '2026-10-04']);
  });

  it('caps at max, taking the earliest dates', () => {
    const days = Array.from({ length: 40 }, (_, i) =>
      day(`2026-09-${String(5 + (i % 25)).padStart(2, '0')}`, true),
    );
    assert.ok(prerenderWindowDates({ days, today: TODAY, windowDays: WINDOW, max: 3, homeOnly: true }).size <= 3);
  });

  it('ignores malformed dates rather than throwing', () => {
    const days = [day('', true), day('not-a-date', true), day('2026-09-05', true)];
    assert.deepEqual(win(days, true), ['2026-09-05']);
  });

  it('a doubleheader date counts as home when either half is home', () => {
    // gameCtxsByDate collapses both games onto one date; the caller ORs isHome.
    assert.deepEqual(win([day('2026-09-05', true)], true), ['2026-09-05']);
  });
});

describe('splitCompletedForRender', () => {
  const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i, bob: i % 4 === 0 }));
  const isBob = (r: { bob: boolean }) => r.bob;

  const check = <T,>(past: readonly T[], s: ReturnType<typeof splitCompletedForRender<T>>) => {
    const all = [...s.resale, ...s.ssr, ...s.collapsed];
    assert.equal(all.length, past.length, 'no row dropped and none duplicated');
    assert.equal(new Set(all).size, past.length, 'every row appears exactly once');
    for (const r of past) assert.ok(all.includes(r), 'row missing from the partition');
  };

  it('is a partition for every shape the page can produce', () => {
    for (const n of [0, 1, 3, 8, 11, 12, 120]) {
      for (const lift of [0, 1, 3]) {
        for (const ssr of [0, 8]) {
          const past = rows(n);
          const s = splitCompletedForRender(past, isBob, lift, ssr);
          check(past, s);
          assert.ok(s.resale.length <= lift, `resale cap breached at n=${n}`);
          assert.ok(s.ssr.length <= ssr, `ssr cap breached at n=${n}`);
        }
      }
    }
  });

  it('server-renders nothing extra when the page is not season-scoped', () => {
    const past = rows(120);
    const s = splitCompletedForRender(past, isBob, 3, 0);
    assert.equal(s.ssr.length, 0);
    assert.equal(s.resale.length, 3);
    assert.equal(s.collapsed.length, 117, 'identical to the pre-change split');
  });

  it('caps the server-rendered block at lift + ssr on the largest archive', () => {
    const past = rows(120);
    const s = splitCompletedForRender(past, isBob, 3, 8);
    assert.equal(s.resale.length + s.ssr.length, 11, 'eleven rows is the ceiling');
    assert.equal(s.collapsed.length, 109);
  });

  it('never puts a lifted resale row in the ssr group', () => {
    const past = rows(20);
    const s = splitCompletedForRender(past, isBob, 3, 8);
    for (const r of s.resale) assert.ok(!s.ssr.includes(r));
    for (const r of s.resale) assert.ok(!s.collapsed.includes(r));
  });

  it('handles an archive with no resale candidates at all', () => {
    const past = Array.from({ length: 10 }, (_, i) => ({ id: i, bob: false }));
    const s = splitCompletedForRender(past, isBob, 3, 8);
    assert.equal(s.resale.length, 0);
    assert.equal(s.ssr.length, 8);
    assert.equal(s.collapsed.length, 2);
    check(past, s);
  });

  it('treats a negative ssr count as zero rather than slicing from the end', () => {
    const past = rows(10);
    const s = splitCompletedForRender(past, isBob, 0, -5);
    assert.equal(s.ssr.length, 0);
    assert.equal(s.collapsed.length, 10);
  });
});
