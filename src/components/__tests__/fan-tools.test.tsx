/* FanTools — the fan-made companion app module in the team-page sidebar.
 *
 * These tests assert the DECISIONS, not the markup: who the module renders
 * for, what claims reach a reader, that the outbound link carries the rel the
 * brief specified, and that nothing here leaks into structured data.
 *
 * The failure this file exists for is the SILENT one. The config is keyed by
 * Team.id and a key matching no real team is not a type error and not a test
 * failure anywhere else in the codebase — the module would simply never
 * render, on a page nobody is watching. The last test closes that by checking
 * every key against an independently generated slug table. */
import { test } from 'node:test';
import assert from 'node:assert';
import { renderToStaticMarkup } from 'react-dom/server';
import { FanTools } from '../redesign/FanTools';
import { PARTNER_APPS, getPartnerApp } from '@/config/partner-apps';
import { FANATICS_AD_IDS } from '@/lib/fanatics-ad-ids';
import type { Team } from '@/lib/types';

const team = (id: string): Team => ({
  id,
  city: 'Minneapolis',
  name: 'Timberwolves',
  abbreviation: 'MIN',
  primaryColor: '#0C2340',
  secondaryColor: '#236192',
  league: 'NBA',
  sportSlug: 'nba',
  division: 'Northwest',
});

const render = (id: string) => renderToStaticMarkup(<FanTools team={team(id)} />);

test('a team with no config entry renders nothing at all, not an empty shell', () => {
  assert.equal(render('boston-celtics'), '');
  assert.equal(getPartnerApp('boston-celtics'), null);
});

test('the configured team renders every supplied line', () => {
  const html = render('minnesota-timberwolves');
  const app = PARTNER_APPS['minnesota-timberwolves'];

  assert.ok(html.includes('Free food promos at Target Center'), 'heading missing');
  for (const paragraph of app.intro) {
    // Escape the apostrophe the same way React does on the way out.
    assert.ok(html.includes(paragraph.replace(/'/g, '&#x27;')), `intro paragraph missing: ${paragraph.slice(0, 40)}`);
  }
  assert.ok(html.includes('Wolves Chicken'), 'app name missing');
  assert.ok(html.includes('David Cocchiarella'), 'developer missing');
  assert.ok(html.includes('iOS'), 'platform label missing');
  assert.ok(html.includes('App Store'), 'store button label missing');
  assert.ok(/not affiliated with the Timberwolves/.test(html), 'disclosure missing');
});

test('the outbound link carries the brief\'s rel and opens in a new tab', () => {
  const html = render('minnesota-timberwolves');
  assert.ok(
    html.includes('href="https://apps.apple.com/us/app/wolves-chicken/id6761731987"'),
    'the store URL must reach the DOM',
  );
  assert.ok(html.includes('rel="nofollow noopener"'), 'rel must be exactly nofollow noopener');
  assert.ok(html.includes('target="_blank"'), 'target must be _blank');
});

test('the module emits no structured data of its own', () => {
  const html = render('minnesota-timberwolves');
  assert.ok(!/application\/ld\+json/.test(html), 'FanTools must not emit JSON-LD');
  assert.ok(!/SoftwareApplication|MobileApplication/.test(html), 'that entity was removed sitewide');
});

test('the disclosure names every party, because an app card is a claim about third parties', () => {
  const html = render('minnesota-timberwolves');
  for (const party of ['Timberwolves', 'Chick-fil-A', 'McDonald']) {
    assert.ok(html.includes(party), `disclosure must name ${party}`);
  }
  assert.ok(/Independent fan-made app/.test(html), 'the app must be labelled independent');
});

test('every config key is a real team slug, checked against an independent table', () => {
  // FANATICS_AD_IDS is generated from Impact's directory export, not from this
  // file, so agreement is corroboration rather than a restatement. It covers
  // 121 of 169 teams; a future key outside that set needs its own evidence
  // rather than a loosened assertion.
  for (const key of Object.keys(PARTNER_APPS)) {
    assert.ok(
      key in FANATICS_AD_IDS,
      `"${key}" is not a known team slug — the module would silently never render`,
    );
  }
});

test('config values are shaped for publication, since name and developer are printed verbatim', () => {
  for (const [key, app] of Object.entries(PARTNER_APPS)) {
    assert.ok(app.name.trim().length > 0, `${key}: name is required, it is printed on the card`);
    assert.ok(app.developer.trim().length > 0, `${key}: developer is required, it is printed on the card`);
    assert.ok(app.url.startsWith('https://'), `${key}: url must be https`);
    assert.ok(app.intro.length > 0, `${key}: the section needs at least one explainer paragraph`);
    assert.ok(app.disclosure.trim().length > 0, `${key}: a partner card without a disclosure must not ship`);
    // An iOS entry that does not point at the App Store is a copy/paste error
    // the card would present as fact.
    if (app.platform === 'ios') {
      assert.ok(app.url.includes('apps.apple.com'), `${key}: ios entry must link to apps.apple.com`);
    }
  }
});
