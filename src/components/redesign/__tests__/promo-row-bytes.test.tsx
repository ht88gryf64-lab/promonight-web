// The promo row's byte budget (2026-11-07). A team page renders one of these
// per visible row and its server HTML sits under a 950,000-byte cap (live
// guard 2 in scripts/live/team-pages.live.test.ts, headroom under Bing's 1 MB
// ceiling). The Twins page crossed the cap by 470 bytes the day the row became
// a whole-row Link, from 697 bytes of anchor markup on nine completed rows.
// The row's long utility strings are now scoped classes (globals.css "Promo
// row byte budget"); this holds the result so it cannot creep back silently.
// Budgets are the measured size after the trim plus a small allowance; raise
// one only with a reason written here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { RedesignPromoRow } from '../RedesignPromoRow';
import type { PromoWithTeam, Team } from '@/lib/types';

const WILD = { id: 'minnesota-wild', name: 'Wild', city: 'Minnesota', league: 'NHL', sportSlug: 'nhl', abbreviation: 'MIN', primaryColor: '#154734', secondaryColor: '#A6192E', division: 'Central' } as unknown as Team;
// A fixed fixture: the budget measures the markup, so the words are short and constant.
const promo: PromoWithTeam = { team: WILD, date: '2026-11-30', time: '', opponent: '', type: 'giveaway', title: 'Blaze Orange Hat', description: 'All fans receive a hat.', highlight: false, icon: '', recurring: false, pageSlug: 'blaze-orange-hat', displayOpponent: 'Islanders' };
const share = { teamName: 'Minnesota Wild', teamSlug: WILD.id, sport: 'nhl' };
const bytes = (s: string) => Buffer.byteLength(s, 'utf8');

const COMPLETED_ROW_BUDGET = 2600;
const UPCOMING_ROW_BUDGET = 3200;
const ANCHOR_OPEN_BUDGET = 80;

test(`a completed row's server markup stays under ${COMPLETED_ROW_BUDGET} bytes`, () => {
  const html = renderToStaticMarkup(<RedesignPromoRow promo={promo} share={share} completed />);
  assert.ok(bytes(html) <= COMPLETED_ROW_BUDGET, `${bytes(html)} bytes`);
  const open = html.match(/<a [^>]*>/)![0];
  assert.ok(bytes(open) <= ANCHOR_OPEN_BUDGET, `anchor open tag ${bytes(open)} bytes: ${open}`);
  assert.match(open, /class="rd-row-link"/);
});

test(`an upcoming row with the Tickets button stays under ${UPCOMING_ROW_BUDGET} bytes`, () => {
  const html = renderToStaticMarkup(<RedesignPromoRow promo={promo} share={share} team={WILD} contexts={null} interactive />);
  assert.ok(bytes(html) <= UPCOMING_ROW_BUDGET, `${bytes(html)} bytes`);
  assert.match(html, /<button type="button" class="rd-row-tickets">/);
});
