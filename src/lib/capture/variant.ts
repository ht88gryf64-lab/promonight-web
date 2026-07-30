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

/** The two experiment arms. Exactly two, forever: this is what gets compared. */
export type CaptureArm = 'control' | 'variant_a';

/**
 * What actually gets REPORTED on a capture event. The arms plus 'unassigned',
 * which is not an arm and never appears on a shown event.
 *
 * 'unassigned' exists so a storage-less browser cannot contaminate the control
 * arm. Reporting those sessions as 'control' would have worked only if every
 * future reader remembered to filter them out by suppression_reason first, and
 * a caveat in this file is not where someone reading an arm-balance chart will
 * be looking. A distinct value makes the contamination impossible instead of
 * documented.
 */
export type CaptureVariant = CaptureArm | 'unassigned';

export const CAPTURE_ARMS: readonly CaptureArm[] = ['control', 'variant_a'];

export function isCaptureArm(value: unknown): value is CaptureArm {
  return value === 'control' || value === 'variant_a';
}

/**
 * The visitor's arm, assigned once and stable forever after.
 *
 * Stability is the whole point: reassigning on reload would put the same person
 * in both arms and make every rate meaningless. So a stored value is always
 * returned as-is and the flip happens only when nothing valid is stored.
 *
 * When no assignment can be PERSISTED this returns 'unassigned', never an arm.
 * That covers storage being unavailable and storage that accepts writes then
 * discards them. Such sessions are suppressed with reason storage_unavailable
 * and so never reach a shown event, but they do emit suppressed events, and
 * tagging those with a real arm would quietly skew the balance chart.
 */
export function resolveVariant(local: SafeStorage, random: () => number = Math.random): CaptureVariant {
  if (!local.available) return 'unassigned';

  const stored = local.get(KEY_VARIANT);
  if (isCaptureArm(stored)) return stored;

  const assigned: CaptureArm = random() < 0.5 ? 'control' : 'variant_a';
  local.set(KEY_VARIANT, assigned);

  // Read back rather than trusting the write. A set() that silently failed on
  // quota would otherwise hand out a fresh arm on every page, which is the
  // reassignment this function exists to prevent. An unconfirmed write means no
  // durable assignment exists, so it reports unassigned rather than the arm the
  // coin happened to pick.
  const confirmed = local.get(KEY_VARIANT);
  return isCaptureArm(confirmed) ? confirmed : 'unassigned';
}
