// The sheet's newsletter_signup payload.
//
// One property carries real weight here and it is the one the type system
// cannot enforce: page_type is OPTIONAL on NewsletterSignupProperties, because
// the /follow form has no page type to report, so dropping it from the sheet's
// payload type-checks clean. The result would not be an error, it would be one
// believable pooled number across two placements that share a source tag and
// share almost nothing else.
//
// Run with:
//   node --import tsx --experimental-test-module-mocks --test <this file>

import { test } from 'node:test';
import assert from 'node:assert';

import { sheetSignupProperties } from '../signup-event';
import type { CapturePromptContext } from '../../analytics';

function context(overrides: Partial<CapturePromptContext> = {}): CapturePromptContext {
  return {
    surface: 'web_engagement_capture',
    page_type: 'team_page',
    team_id: 'minnesota-twins',
    variant: 'variant_a',
    ...overrides,
  };
}

test('the sheet signup carries page_type, which is what splits the two placements', () => {
  const teamPage = sheetSignupProperties(context({ page_type: 'team_page' }), 1);
  const aggregator = sheetSignupProperties(
    context({ page_type: 'aggregator', team_id: null }),
    0,
  );

  assert.strictEqual(teamPage.page_type, 'team_page');
  assert.strictEqual(aggregator.page_type, 'aggregator');
  // Both write the same source. Without page_type the two rows are one row.
  assert.strictEqual(teamPage.surface, aggregator.surface);
  assert.notStrictEqual(teamPage.page_type, aggregator.page_type);
});

test('the surface is the sheet tag, which is the whole sheet-vs-CTA comparison', () => {
  assert.strictEqual(sheetSignupProperties(context(), 1).surface, 'web_engagement_capture');
});

test('team_count comes from the submitted teams, not from the context', () => {
  // The aggregator sheet has no page team and posts an empty array; a payload
  // that read team_id instead would report 1 for a signup that saved nothing.
  assert.strictEqual(sheetSignupProperties(context({ team_id: null }), 0).team_count, 0);
  assert.strictEqual(sheetSignupProperties(context(), 1).team_count, 1);
});

test('the arm is passed through unchanged, including unassigned', () => {
  // Inert, but it must not be silently normalised: unassigned is a third value,
  // never an arm, and folding it into control is the contamination the third
  // value exists to prevent.
  for (const v of ['control', 'variant_a', 'unassigned'] as const) {
    assert.strictEqual(sheetSignupProperties(context({ variant: v }), 1).variant, v);
  }
});
