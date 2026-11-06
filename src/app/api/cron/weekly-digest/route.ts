/**
 * GET /api/cron/weekly-digest
 *
 * Weekly send. Iterates CONFIRMED subscribers only (pending + unsubscribed are
 * excluded at the query). One email per subscriber:
 *   - teams non-empty  -> personalized digest of their teams' promos in the next
 *     7 days. If that set is EMPTY, the subscriber gets the empty-window variant
 *     instead of being skipped: a personalized opener plus a local section of
 *     nearby promos around the followed-team market (team-proxy -> national
 *     fallback), counted by cascade level. No subscriber location is read:
 *     subscribers carry none (2026-10-07).
 *   - teams empty      -> generic "hot promos" email built from the same window
 *     data, with links to the aggregator pages.
 *
 * Auth: CRON_SECRET bearer, same as /api/cron/mlb-schedule.
 *
 * THE SCHEDULED RUN SENDS. vercel.json calls this path with ?execute=true
 * every Tuesday at 17:00 UTC, and the sender is configured (SENDER_FROM is a
 * real address, RESEND_API_KEY is set in Production), so that run emails every
 * deduped confirmed recipient. Without ?execute=true (a manual call) the route
 * is a dry run: it logs and returns the full plan (totals, personalized /
 * generic / empty-window counts with the cascade breakdown, send-ceiling check)
 * and sends NOTHING. Either way it needs the cron secret. (Until 2026-10-07
 * this comment said the cron hit the bare path and stayed in dry-run; it had
 * not for some time.)
 *
 * Execute is guarded: it refuses (409) unless the sender is configured
 * (SENDER_FROM off its placeholder + RESEND_API_KEY), refuses if the recipient
 * count exceeds the send safety ceiling (override with &overCap=true), and
 * claims the window so an accidental second run is a no-op (override with
 * &force=true).
 *
 * NO SILENT FAILURES. Every abort past the auth check (the three 409s above),
 * any thrown exception (500), and a run that finished with failed sends mails
 * the operator once via notifyDigestFailure (lib/digest-alert.ts) before the
 * route returns. The 503/401 auth exits do not alert: they are reachable
 * without the secret, so alerting there would let anyone mail the operator.
 */

import { NextResponse } from 'next/server';
import {
  claimDigestRun,
  dedupeByDeliveryInbox,
  getConfirmedSubscribers,
  subscriberDocId,
  type Subscriber,
} from '@/lib/subscribers';
import {
  digestWindow,
  fetchWindowPromos,
  personalizedFor,
  genericFeatured,
  fetchDigestContext,
  type DigestPromo,
} from '@/lib/digest';
import { getAllTeams, getTeamVenueCoords, getSchemaLocationsForTeams } from '@/lib/data';
import { resolveLocalAnchor, buildTeamCityMap, type CascadeLevel } from '@/lib/geo/local-promos';
import {
  isSenderConfigured,
  sendEmptyWindowDigest,
  sendGenericDigest,
  sendPersonalizedDigest,
} from '@/lib/email';
import { teamDisplayName } from '@/lib/team-display-name';
import { notifyDigestFailure, type DigestAlert } from '@/lib/digest-alert';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Safety ceiling on one run's planned emails. Execute aborts above it (unless
// &overCap=true) so a runaway subscriber query cannot mail the world.
//
// This was FREE_TIER_DAILY = 100, the Resend free-tier daily cap. The account
// moved to Resend Pro (no daily cap, 50,000/month), so that value was stale,
// and from 2026-10-20 it aborted every Tuesday run once the list passed 100
// (114 recipients on 2026-11-03). Replaced 2026-11-05. 5000/week stays well
// inside the 50,000/month Pro allowance and sits far above the real list.
const SEND_SAFETY_CEILING = 5000;

interface PlanItem {
  email: string;
  manageToken: string;
  type: 'personalized' | 'generic';
  promoCount: number;
}

interface EmptyPlanItem {
  email: string;
  manageToken: string;
  teamIds: string[];
  teamNames: string[];
  anchorCity: string | null;
  localPromos: DigestPromo[];
  level: CascadeLevel;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, reason: 'not_configured' }, { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const execute = url.searchParams.get('execute') === 'true';
  const mode = execute ? 'execute' : 'dry-run';

  // What is known so far, for an alert raised by an exception part-way through.
  const ctx: RunContext = { window: null, recipients: null };
  // At most ONE operator alert per request, whatever path fails. The alert
  // never throws and never calls back into this route, so it cannot loop.
  let alerted = false;
  const alert: AlertFn = async (a) => {
    if (alerted) return;
    alerted = true;
    await notifyDigestFailure({ mode, window: ctx.window, recipients: ctx.recipients, ...a });
  };

  try {
    return await runDigest(url, execute, ctx, alert);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[cron:weekly-digest] run threw: ${message}`);
    await alert({ reason: 'exception', detail: message });
    return NextResponse.json({ ok: false, reason: 'exception', detail: message, mode }, { status: 500 });
  }
}

interface RunContext {
  window: { start: string; end: string } | null;
  recipients: number | null;
}

type AlertFn = (
  a: Pick<DigestAlert, 'reason' | 'detail' | 'sent' | 'failed'>,
) => Promise<void>;

async function runDigest(url: URL, execute: boolean, ctx: RunContext, alert: AlertFn): Promise<Response> {
  const force = url.searchParams.get('force') === 'true';
  const overCapAck = url.searchParams.get('overCap') === 'true';
  const startedAt = Date.now();

  const subscribers = await getConfirmedSubscribers();
  // Collapse the confirmed set to one record per delivering inbox BEFORE the
  // plan is built, so a duplicate (e.g. a Gmail dot / +suffix alias that hashes
  // to a separate doc) can never produce two emails to the same person. The
  // keep-rule prefers a record with followed teams over an empty one, so a
  // personalized subscriber is never dropped for an empty duplicate. Applied on
  // both the dry-run and execute paths so the plan reflects real recipients.
  const recipients = dedupeByDeliveryInbox(subscribers);
  const collapsedDuplicates = subscribers.length - recipients.length;
  const { start, end } = digestWindow(new Date());
  ctx.window = { start, end };
  const windowPromos = await fetchWindowPromos(start, end);
  const generic = genericFeatured(windowPromos);

  const plan: PlanItem[] = [];
  const personalizedPlan: {
    email: string;
    manageToken: string;
    promos: DigestPromo[];
    total: number;
    teamIds: string[];
  }[] = [];
  const emptyWindowSubs: Subscriber[] = [];

  for (const sub of recipients) {
    if (sub.teams.length > 0) {
      const { promos, total: promoTotal } = personalizedFor(windowPromos, sub.teams);
      if (promoTotal === 0) {
        // Followed teams are quiet this window. Instead of skipping, this
        // subscriber gets the empty-window variant, resolved below.
        emptyWindowSubs.push(sub);
        continue;
      }
      personalizedPlan.push({ email: sub.email, manageToken: sub.manageToken, promos, total: promoTotal, teamIds: sub.teams });
      plan.push({ email: sub.email, manageToken: sub.manageToken, type: 'personalized', promoCount: promoTotal });
    } else {
      plan.push({ email: sub.email, manageToken: sub.manageToken, type: 'generic', promoCount: generic.length });
    }
  }

  // Resolve each empty-window recipient through the local-anchor cascade. The
  // team / venue-coord / venue-city maps are read once, and only when at least
  // one subscriber actually needs them.
  const emptyPlan: EmptyPlanItem[] = [];
  if (emptyWindowSubs.length > 0) {
    const allTeams = await getAllTeams();
    const coords = await getTeamVenueCoords(allTeams);
    const cityByTeamId = buildTeamCityMap(allTeams, await getSchemaLocationsForTeams(allTeams));
    const nameById = new Map(allTeams.map((t) => [t.id, teamDisplayName(t)]));
    for (const sub of emptyWindowSubs) {
      const { anchor, localPromos, level } = resolveLocalAnchor({
        followedTeamIds: sub.teams,
        windowPromos,
        coords,
        cityByTeamId,
      });
      emptyPlan.push({
        email: sub.email,
        manageToken: sub.manageToken,
        teamIds: sub.teams,
        teamNames: sub.teams.map((id) => nameById.get(id) ?? id),
        anchorCity: anchor.city,
        localPromos,
        level,
      });
    }
  }

  const personalizedCount = plan.filter((p) => p.type === 'personalized').length;
  const genericCount = plan.filter((p) => p.type === 'generic').length;
  const emptyCount = emptyPlan.length;
  // Every confirmed recipient now gets an email (the empty-window variant
  // replaces the old skip), so total spans all three variants.
  const total = personalizedCount + genericCount + emptyCount;
  ctx.recipients = total;
  const emptyWindowByLevel = emptyPlan.reduce(
    (acc, e) => {
      acc[e.level] += 1;
      return acc;
    },
    { 'team-proxy': 0, 'national-fallback': 0 } as Record<CascadeLevel, number>,
  );

  const summary = {
    mode: execute ? 'execute' : 'dry-run',
    window: { start, end },
    confirmedSubscribers: subscribers.length,
    dedupedRecipients: recipients.length,
    collapsedDuplicates,
    total,
    personalized: personalizedCount,
    generic: genericCount,
    emptyWindow: emptyCount,
    emptyWindowByLevel,
    sendCeiling: SEND_SAFETY_CEILING,
    withinCeiling: total <= SEND_SAFETY_CEILING,
  };

  console.log(`[cron:weekly-digest] ${JSON.stringify(summary)}`);

  // COUNTS, NEVER ADDRESSES. These two lines used to log one line per recipient
  // with the raw email on it, on every run, including dry runs, which meant the
  // full subscriber list accumulated in the function logs of a route that runs
  // weekly forever. Log retention is not a place we control or audit, and a
  // recipient list is the single most sensitive thing this cron holds.
  //
  // The per-recipient loop existed to answer "did the right people get the right
  // thing", and the aggregates below answer that without naming anyone: the
  // promo-count spread tells you whether personalization actually differentiated,
  // and the empty-window split tells you whether the fallback path is firing for
  // the reason you think. If you ever need to debug ONE subscriber, look them up
  // by the sha256 doc id rather than reinstating this.
  const promoCounts = plan.map((p) => p.promoCount).sort((a, b) => a - b);
  const spread =
    promoCounts.length > 0
      ? {
          min: promoCounts[0],
          median: promoCounts[Math.floor(promoCounts.length / 2)],
          max: promoCounts[promoCounts.length - 1],
        }
      : null;
  const emptyWithCity = emptyPlan.filter((e) => e.anchorCity).length;
  console.log(
    `[cron:weekly-digest] promoCountSpread=${JSON.stringify(spread)} ` +
      `emptyWindow=${emptyPlan.length} withAnchorCity=${emptyWithCity} ` +
      `withoutAnchorCity=${emptyPlan.length - emptyWithCity}`,
  );
  if (!summary.withinCeiling) {
    console.warn(
      `[cron:weekly-digest] WARNING: ${total} recipients exceeds the ${SEND_SAFETY_CEILING} send safety ceiling`,
    );
  }

  if (!execute) {
    return NextResponse.json({
      ok: true,
      ...summary,
      recipients: [
        ...plan.map((p) => ({ email: p.email, type: p.type, promoCount: p.promoCount })),
        ...emptyPlan.map((e) => ({
          email: e.email,
          type: 'empty-window' as const,
          level: e.level,
          localPromoCount: e.localPromos.length,
          anchorCity: e.anchorCity,
          teams: e.teamNames,
        })),
      ],
    });
  }

  // ── Execute ────────────────────────────────────────────────────────────────
  // Refuse to send from the placeholder sender or without a key, rather than
  // firing a batch of guaranteed-to-fail Resend calls.
  // Each abort below mails the operator before returning (see header).
  if (!isSenderConfigured() || !process.env.RESEND_API_KEY) {
    const detail =
      'Set SENDER_FROM (src/lib/email.ts) to a verified Resend sender and configure RESEND_API_KEY before executing.';
    // With no RESEND_API_KEY the alert itself cannot send; notifyDigestFailure
    // logs that at error level so the failure is at least loud in the logs.
    await alert({ reason: 'sender_not_configured', detail });
    return NextResponse.json({ ok: false, reason: 'sender_not_configured', detail, ...summary }, { status: 409 });
  }

  // Over the safety ceiling: stop unless explicitly acknowledged, so a runaway
  // subscriber query cannot mail the world.
  if (!summary.withinCeiling && !overCapAck) {
    const detail = `${total} recipients exceeds the ${SEND_SAFETY_CEILING} send safety ceiling. Re-run with &overCap=true to send anyway.`;
    await alert({ reason: 'exceeds_send_ceiling', detail });
    return NextResponse.json({ ok: false, reason: 'exceeds_send_ceiling', detail, ...summary }, { status: 409 });
  }

  // What every email shares beyond the window rows (team names, the upcoming
  // promo links for "Coming up" and "at other clubs"). Read BEFORE the claim,
  // so a failed read aborts with the window still unclaimed.
  const context = await fetchDigestContext({ start, end }, windowPromos);

  // Idempotency: claim this window so an accidental second execute is a no-op.
  // &force=true overrides for a deliberate re-run.
  const claimed = await claimDigestRun(start, force);
  if (!claimed) {
    const detail = 'This window was already executed. Re-run with &force=true to send again.';
    await alert({ reason: 'already_executed_this_window', detail });
    return NextResponse.json(
      { ok: false, reason: 'already_executed_this_window', detail, ...summary },
      { status: 409 },
    );
  }

  let sent = 0;
  let failed = 0;
  // Sequential sends keep us well under Resend rate limits and make a partial
  // failure easy to reason about. Each iteration is isolated so one malformed
  // recipient/row fails locally instead of aborting the whole batch.
  for (const item of personalizedPlan) {
    try {
      const res = await sendPersonalizedDigest({ ...item, context });
      if (res.ok) sent++;
      else {
        failed++;
        console.error(`[cron:weekly-digest] personalized send failed sub=${subscriberDocId(item.email)}: ${res.error ?? 'unknown'}`);
      }
    } catch (e) {
      failed++;
      console.error(`[cron:weekly-digest] personalized send threw sub=${subscriberDocId(item.email)}: ${e instanceof Error ? e.message : e}`);
    }
  }
  for (const p of plan.filter((x) => x.type === 'generic')) {
    try {
      const res = await sendGenericDigest({
        email: p.email,
        manageToken: p.manageToken,
        featured: generic,
        context,
      });
      if (res.ok) sent++;
      else {
        failed++;
        console.error(`[cron:weekly-digest] generic send failed sub=${subscriberDocId(p.email)}: ${res.error ?? 'unknown'}`);
      }
    } catch (e) {
      failed++;
      console.error(`[cron:weekly-digest] generic send threw sub=${subscriberDocId(p.email)}: ${e instanceof Error ? e.message : e}`);
    }
  }
  for (const e of emptyPlan) {
    try {
      const res = await sendEmptyWindowDigest({
        email: e.email,
        manageToken: e.manageToken,
        teamIds: e.teamIds,
        teamNames: e.teamNames,
        level: e.level,
        localPromos: e.localPromos,
        featured: generic,
        context,
      });
      if (res.ok) sent++;
      else {
        failed++;
        console.error(`[cron:weekly-digest] empty-window send failed sub=${subscriberDocId(e.email)}: ${res.error ?? 'unknown'}`);
      }
    } catch (err) {
      failed++;
      console.error(
        `[cron:weekly-digest] empty-window send threw sub=${subscriberDocId(e.email)}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  const durationMs = Date.now() - startedAt;
  console.log(`[cron:weekly-digest] execute done in ${durationMs}ms sent=${sent} failed=${failed}`);
  // Per-recipient failures are caught in the loops above so one bad row cannot
  // stop the batch; they are reported here as ONE alert for the run, never one
  // per recipient.
  if (failed > 0) {
    await alert({ reason: 'send_failures', detail: `${failed} of ${sent + failed} sends failed.`, sent, failed });
  }
  return NextResponse.json({ ok: failed === 0, ...summary, sent, failed, durationMs });
}
