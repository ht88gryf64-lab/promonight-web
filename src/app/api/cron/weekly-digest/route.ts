/**
 * GET /api/cron/weekly-digest
 *
 * Weekly send. Iterates CONFIRMED subscribers only (pending + unsubscribed are
 * excluded at the query). One email per subscriber:
 *   - teams non-empty  -> personalized digest of their teams' promos in the next
 *     7 days. If that set is EMPTY, the subscriber is SKIPPED for the week (no
 *     empty send) and counted in the dry-run output.
 *   - teams empty      -> generic "hot promos" email built from the same window
 *     data, with links to the aggregator pages.
 *
 * Auth: CRON_SECRET bearer, same as /api/cron/mlb-schedule.
 *
 * DRY-RUN BY DEFAULT. The route logs and returns the full plan (totals,
 * personalized vs generic counts, skip count, free-tier check) but sends
 * NOTHING. A live send requires BOTH the cron secret AND ?execute=true. The
 * scheduled Vercel cron (vercel.json) hits the bare path, so it stays in
 * dry-run until the path is changed to add ?execute=true.
 *
 * Execute is guarded: it refuses (409) unless the sender is configured
 * (SENDER_FROM off its placeholder + RESEND_API_KEY), refuses if the recipient
 * count exceeds the free-tier cap (override with &overCap=true), and claims the
 * window so an accidental second run is a no-op (override with &force=true).
 */

import { NextResponse } from 'next/server';
import { claimDigestRun, dedupeByDeliveryInbox, getConfirmedSubscribers } from '@/lib/subscribers';
import {
  digestWindow,
  fetchWindowPromos,
  personalizedFor,
  genericFeatured,
  DIGEST_COLLECTIONS,
  type DigestPromo,
} from '@/lib/digest';
import { isSenderConfigured, sendGenericDigest, sendPersonalizedDigest } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Resend free tier daily cap. The dry-run surfaces total vs this so volume can
// be checked before a live send; not auto-enforced.
const FREE_TIER_DAILY = 100;

interface PlanItem {
  email: string;
  manageToken: string;
  type: 'personalized' | 'generic';
  promoCount: number;
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
  const windowPromos = await fetchWindowPromos(start, end);
  const generic = genericFeatured(windowPromos);

  const plan: PlanItem[] = [];
  const personalizedPlan: {
    email: string;
    manageToken: string;
    promos: DigestPromo[];
    total: number;
  }[] = [];
  const skippedEmpty: string[] = [];

  for (const sub of recipients) {
    if (sub.teams.length > 0) {
      const { promos, total: promoTotal } = personalizedFor(windowPromos, sub.teams);
      if (promoTotal === 0) {
        // Followed teams have nothing in the window -> no empty send this week.
        skippedEmpty.push(sub.email);
        continue;
      }
      personalizedPlan.push({ email: sub.email, manageToken: sub.manageToken, promos, total: promoTotal });
      plan.push({ email: sub.email, manageToken: sub.manageToken, type: 'personalized', promoCount: promoTotal });
    } else {
      plan.push({ email: sub.email, manageToken: sub.manageToken, type: 'generic', promoCount: generic.length });
    }
  }

  const personalizedCount = plan.filter((p) => p.type === 'personalized').length;
  const genericCount = plan.filter((p) => p.type === 'generic').length;
  const total = plan.length;

  const summary = {
    mode: execute ? 'execute' : 'dry-run',
    window: { start, end },
    confirmedSubscribers: subscribers.length,
    dedupedRecipients: recipients.length,
    collapsedDuplicates,
    total,
    personalized: personalizedCount,
    generic: genericCount,
    skippedEmpty: skippedEmpty.length,
    freeTierCap: FREE_TIER_DAILY,
    withinFreeTier: total <= FREE_TIER_DAILY,
  };

  console.log(`[cron:weekly-digest] ${JSON.stringify(summary)}`);
  for (const p of plan) {
    console.log(`[cron:weekly-digest] -> ${p.type} ${p.email} (${p.promoCount} promos)`);
  }
  for (const e of skippedEmpty) {
    console.log(`[cron:weekly-digest] skip(empty-window) ${e}`);
  }
  if (!summary.withinFreeTier) {
    console.warn(
      `[cron:weekly-digest] WARNING: ${total} recipients exceeds the ${FREE_TIER_DAILY}/day free-tier cap`,
    );
  }

  if (!execute) {
    return NextResponse.json({
      ok: true,
      ...summary,
      recipients: plan.map((p) => ({ email: p.email, type: p.type, promoCount: p.promoCount })),
      skippedEmails: skippedEmpty,
    });
  }

  // ── Execute ────────────────────────────────────────────────────────────────
  // Refuse to send from the placeholder sender or without a key, rather than
  // firing a batch of guaranteed-to-fail Resend calls.
  if (!isSenderConfigured() || !process.env.RESEND_API_KEY) {
    return NextResponse.json(
      {
        ok: false,
        reason: 'sender_not_configured',
        detail:
          'Set SENDER_FROM (src/lib/email.ts) to a verified Resend sender and configure RESEND_API_KEY before executing.',
        ...summary,
      },
      { status: 409 },
    );
  }

  // Over the free-tier daily cap: stop unless explicitly acknowledged, so we
  // never silently burn quota and drop the overflow recipients at Resend.
  if (!summary.withinFreeTier && !overCapAck) {
    return NextResponse.json(
      {
        ok: false,
        reason: 'exceeds_free_tier',
        detail: `${total} recipients exceeds the ${FREE_TIER_DAILY}/day cap. Re-run with &overCap=true to send anyway.`,
        ...summary,
      },
      { status: 409 },
    );
  }

  // Idempotency: claim this window so an accidental second execute is a no-op.
  // &force=true overrides for a deliberate re-run.
  const claimed = await claimDigestRun(start, force);
  if (!claimed) {
    return NextResponse.json(
      {
        ok: false,
        reason: 'already_executed_this_window',
        detail: 'This window was already executed. Re-run with &force=true to send again.',
        ...summary,
      },
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
      const res = await sendPersonalizedDigest(item);
      if (res.ok) sent++;
      else {
        failed++;
        console.error(`[cron:weekly-digest] personalized send failed ${item.email}: ${res.error ?? 'unknown'}`);
      }
    } catch (e) {
      failed++;
      console.error(`[cron:weekly-digest] personalized send threw ${item.email}: ${e instanceof Error ? e.message : e}`);
    }
  }
  for (const p of plan.filter((x) => x.type === 'generic')) {
    try {
      const res = await sendGenericDigest({
        email: p.email,
        manageToken: p.manageToken,
        featured: generic,
        collections: DIGEST_COLLECTIONS,
      });
      if (res.ok) sent++;
      else {
        failed++;
        console.error(`[cron:weekly-digest] generic send failed ${p.email}: ${res.error ?? 'unknown'}`);
      }
    } catch (e) {
      failed++;
      console.error(`[cron:weekly-digest] generic send threw ${p.email}: ${e instanceof Error ? e.message : e}`);
    }
  }

  const durationMs = Date.now() - startedAt;
  console.log(`[cron:weekly-digest] execute done in ${durationMs}ms sent=${sent} failed=${failed}`);
  return NextResponse.json({ ok: failed === 0, ...summary, sent, failed, durationMs });
}
