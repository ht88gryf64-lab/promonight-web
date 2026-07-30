// A/B arm assignment, without PostHog experiments.
//
// The repo has zero feature-flag wiring: no bootstrap, no onFeatureFlags, no
// posthog-node, and the posthog-js instance only appears on window after an
// async import resolves post-hydration. Reading a flag would mean either
// blocking on that import or accepting an undefined arm on first paint, and
// adding server-side flags would mean a new dependency and a rendering strategy
// change for 167 statically generated pages. A coin flip in localStorage costs
// none of that and answers the only question Phase 2 asks.
//
// TWO ARMS, and CONTROL IS NOT INERT. Control runs the full counter, the full
// timer and the full suppression check, and emits capture_prompt_shown exactly
// as the variant does. It simply would not render a sheet once one exists. That
// is what makes the arms comparable: without it, Phase 2 would be comparing
// "sessions that reached the trigger" against "all sessions" and the lift would
// be unmeasurable.

import { KEY_VARIANT, type SafeStorage } from './storage';

export type CaptureVariant = 'control' | 'variant_a';

export const CAPTURE_VARIANTS: readonly CaptureVariant[] = ['control', 'variant_a'];

export function isCaptureVariant(value: unknown): value is CaptureVariant {
  return value === 'control' || value === 'variant_a';
}

/**
 * The visitor's arm, assigned once and stable forever after.
 *
 * Stability is the whole point: reassigning on reload would put the same person
 * in both arms and make every rate meaningless. So a stored value is always
 * returned as-is and the flip happens only when nothing valid is stored.
 *
 * When storage is unavailable this returns 'control' WITHOUT persisting, since
 * there is nowhere to persist to. Those sessions are suppressed anyway with
 * reason storage_unavailable, so they never reach a shown event, but they do
 * emit suppressed events tagged control. Filter on suppression_reason before
 * reading arm balance, or storage-less browsers will look like a control skew.
 */
export function resolveVariant(local: SafeStorage, random: () => number = Math.random): CaptureVariant {
  if (!local.available) return 'control';

  const stored = local.get(KEY_VARIANT);
  if (isCaptureVariant(stored)) return stored;

  const assigned: CaptureVariant = random() < 0.5 ? 'control' : 'variant_a';
  local.set(KEY_VARIANT, assigned);

  // Read back rather than trusting the write. A set() that silently failed on
  // quota would otherwise hand out a fresh arm on every page, which is the
  // reassignment this function exists to prevent.
  const confirmed = local.get(KEY_VARIANT);
  return isCaptureVariant(confirmed) ? confirmed : 'control';
}
