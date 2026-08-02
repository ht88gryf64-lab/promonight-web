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

import { isCaptureTriggerEnabledClient } from './gate';
import { browserStorage, KEY_VARIANT, type SafeStorage } from './storage';

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

/**
 * This browser's arm, for callers that hold no SafeStorage handle of their own.
 *
 * ADDS NO LOGIC, DELIBERATELY. The flip, the write and the read-back all still
 * happen in exactly one place, resolveVariant above. This is a handle-getter, not
 * a second assignment path: two callers racing on a brand-new browser cannot
 * produce two different arms, because the first to run persists one and every
 * later call returns it from storage at the `isCaptureArm(stored)` line.
 *
 * CaptureTrigger deliberately does NOT use this. It already builds a local
 * SafeStorage for the trigger engine and passes that same handle to
 * resolveVariant, so routing it through here would probe storage twice per mount
 * for an identical answer.
 *
 * SAFE ON THE PAGEVIEW PATH, which is the reason it exists. browserStorage
 * returns an unavailable store during SSR and in browsers that refuse storage,
 * and resolveVariant answers 'unassigned' for those instead of throwing, so this
 * needs no guard at the call site and cannot break a page that merely rendered.
 */
export function resolveBrowserVariant(): CaptureVariant {
  // THE KILL SWITCH IS CHECKED HERE, AND IT HAS TO BE.
  //
  // gate.ts promises that OFF means "no storage touched", and calls that a kill
  // switch rather than a feature flag. CaptureTrigger honours that by checking
  // before it builds any storage at all. This function is reached from the
  // PAGEVIEW path instead, which has no such check of its own and runs on every
  // route in the app, so without this line an emergency rollback would still be
  // writing an arm into every visitor's localStorage. That is precisely the
  // promise the gate file makes, and breaking it silently is worse than the
  // stamping is useful.
  //
  // Off therefore reports 'unassigned': there is genuinely no arm on the event.
  // The two causes of that value, storage refused and feature disabled, are not
  // distinguishable on the event, which is acceptable only because they cannot
  // co-occur with a live experiment: when the gate is off no capture event is
  // emitted at all, so any arm-balance read is already time-bounded to a window
  // where the gate was on. Bound the query, as the runbook says to.
  if (!isCaptureTriggerEnabledClient()) return 'unassigned';
  return resolveVariant(browserStorage('local'));
}
