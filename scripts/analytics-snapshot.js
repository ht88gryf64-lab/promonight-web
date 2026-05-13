/**
 * Analytics Snapshot Script
 *
 * Pulls 30-day analytics from GA4 + PostHog and prints a side-by-side summary.
 * Writes a JSON snapshot to scripts/snapshots/ for archival.
 *
 * Required env vars (in .env.local, NEVER commit):
 *
 *   GA4_PROPERTY_ID            Numeric GA4 property ID (Admin > Property Settings)
 *   GOOGLE_APPLICATION_CREDENTIALS  Path to service account JSON
 *                              (create in GCP Console, grant 'Viewer' role on
 *                              the GA4 property at analytics.google.com >
 *                              Admin > Property access management)
 *
 *   POSTHOG_PERSONAL_API_KEY   Personal API key from posthog.com/me/settings
 *   POSTHOG_PROJECT_ID         Numeric project ID (PostHog > Settings > Project)
 *   POSTHOG_HOST               Optional, defaults to https://us.i.posthog.com
 *
 * Run:
 *   node --env-file=.env.local scripts/analytics-snapshot.js
 *
 * Either credential set can be missing. Script will skip that source
 * and report on whichever it can reach.
 */

const fs = require('node:fs');
const path = require('node:path');

const SNAPSHOT_DIR = path.join(__dirname, 'snapshots');

async function fetchGA4() {
  const propertyId = process.env.GA4_PROPERTY_ID;
  if (!propertyId) {
    console.warn('[GA4] Skipping: GA4_PROPERTY_ID not set');
    return null;
  }
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.warn('[GA4] Skipping: GOOGLE_APPLICATION_CREDENTIALS not set');
    return null;
  }

  const { BetaAnalyticsDataClient } = require('@google-analytics/data');
  const client = new BetaAnalyticsDataClient();
  const property = `properties/${propertyId}`;

  const [totals] = await client.runReport({
    property,
    dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'screenPageViews' },
      { name: 'bounceRate' },
      { name: 'averageSessionDuration' },
    ],
  });

  const [weekly] = await client.runReport({
    property,
    dateRanges: [{ startDate: '28daysAgo', endDate: 'today' }],
    dimensions: [{ name: 'week' }],
    metrics: [{ name: 'sessions' }],
    orderBys: [{ dimension: { dimensionName: 'week' }, desc: false }],
  });

  const [pages] = await client.runReport({
    property,
    dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
    dimensions: [{ name: 'pagePath' }],
    metrics: [{ name: 'sessions' }, { name: 'screenPageViews' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 10,
  });

  const [sources] = await client.runReport({
    property,
    dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
    dimensions: [{ name: 'sessionDefaultChannelGroup' }],
    metrics: [{ name: 'sessions' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
  });

  return { totals, weekly, pages, sources };
}

async function fetchPostHog() {
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;
  if (!apiKey || !projectId) {
    console.warn('[PostHog] Skipping: POSTHOG_PERSONAL_API_KEY or POSTHOG_PROJECT_ID not set');
    return null;
  }
  const host = process.env.POSTHOG_HOST || 'https://us.i.posthog.com';

  async function hogql(query) {
    const res = await fetch(`${host}/api/projects/${projectId}/query/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
    });
    if (!res.ok) {
      throw new Error(`PostHog ${res.status}: ${await res.text()}`);
    }
    return res.json();
  }

  const [totals, weekly, affiliates, adSlots] = await Promise.all([
    hogql(`SELECT count(DISTINCT $session_id) as sessions,
                  count(*) as events,
                  count(DISTINCT distinct_id) as users
           FROM events
           WHERE timestamp >= now() - INTERVAL 30 DAY`),
    hogql(`SELECT toStartOfWeek(timestamp) as week,
                  count(DISTINCT $session_id) as sessions
           FROM events
           WHERE timestamp >= now() - INTERVAL 28 DAY
           GROUP BY week
           ORDER BY week ASC`),
    hogql(`SELECT properties.partner as partner, count(*) as clicks
           FROM events
           WHERE event = 'affiliate_click'
             AND timestamp >= now() - INTERVAL 30 DAY
           GROUP BY partner
           ORDER BY clicks DESC`),
    hogql(`SELECT count(*) as total
           FROM events
           WHERE event = 'ad_slot_viewed'
             AND timestamp >= now() - INTERVAL 30 DAY`),
  ]);

  return { totals, weekly, affiliates, adSlots };
}

function fmtNum(n) {
  return Number(n ?? 0).toLocaleString('en-US');
}

function ymd(d) {
  return d.toISOString().slice(0, 10);
}

function ga4Metric(report, name) {
  const idx = report?.metricHeaders?.findIndex((h) => h.name === name) ?? -1;
  if (idx < 0) return null;
  const v = report?.rows?.[0]?.metricValues?.[idx]?.value;
  return v == null ? null : Number(v);
}

function printSummary({ generatedAt, windowStart, windowEnd, ga4, posthog }) {
  console.log('');
  console.log('=== ANALYTICS SNAPSHOT ===');
  console.log('');
  console.log(`Generated: ${generatedAt}`);
  console.log(`Window:    ${windowStart} to ${windowEnd} (30 days)`);
  console.log('');

  const ga4Sessions = ga4 ? ga4Metric(ga4.totals, 'sessions') : null;
  const ga4Pageviews = ga4 ? ga4Metric(ga4.totals, 'screenPageViews') : null;
  const phSessions = posthog?.totals?.results?.[0]?.[0] ?? null;

  console.log('--- SESSIONS (30 days) ---');
  console.log(`  GA4:     ${ga4 ? fmtNum(ga4Sessions) : 'skipped'}`);
  console.log(`  PostHog: ${posthog ? fmtNum(phSessions) : 'skipped'}`);
  console.log('');

  if (ga4) {
    const users = ga4Metric(ga4.totals, 'totalUsers');
    const bounce = ga4Metric(ga4.totals, 'bounceRate');
    const avgDur = ga4Metric(ga4.totals, 'averageSessionDuration');
    console.log('--- GA4 DETAIL ---');
    console.log(`  Users:         ${fmtNum(users)}`);
    console.log(`  Pageviews:     ${fmtNum(ga4Pageviews)}`);
    console.log(`  Bounce rate:   ${((bounce ?? 0) * 100).toFixed(1)}%`);
    console.log(`  Avg session:   ${Math.round(avgDur ?? 0)}s`);
    console.log('');

    // GA4 'week' dimension returns ISO week index (YYYYWW), not a date.
    console.log('  Weekly trend:');
    for (const row of ga4.weekly?.rows ?? []) {
      const week = row.dimensionValues?.[0]?.value ?? '';
      const s = Number(row.metricValues?.[0]?.value ?? 0);
      console.log(`    Week ${week}: ${fmtNum(s)} sessions`);
    }
    console.log('');

    console.log('  Top 10 pages:');
    let i = 0;
    for (const row of ga4.pages?.rows ?? []) {
      i++;
      const p = row.dimensionValues?.[0]?.value ?? '';
      const s = Number(row.metricValues?.[0]?.value ?? 0);
      const pv = Number(row.metricValues?.[1]?.value ?? 0);
      console.log(`    ${String(i).padStart(2)}. ${p.padEnd(32)} ${fmtNum(s)} sessions / ${fmtNum(pv)} pv`);
    }
    console.log('');

    console.log('  Traffic sources:');
    for (const row of ga4.sources?.rows ?? []) {
      const c = row.dimensionValues?.[0]?.value ?? '(unset)';
      const s = Number(row.metricValues?.[0]?.value ?? 0);
      console.log(`    ${c}: ${fmtNum(s)}`);
    }
    console.log('');
  }

  if (posthog) {
    const affiliateRows = posthog.affiliates?.results ?? [];
    const totalClicks = affiliateRows.reduce((acc, r) => acc + Number(r[1] || 0), 0);
    const partnerCount = affiliateRows.length;
    console.log('--- POSTHOG DETAIL ---');
    console.log(`  Affiliate clicks: ${fmtNum(totalClicks)} (across ${partnerCount} partner${partnerCount === 1 ? '' : 's'})`);
    for (const [partner, clicks] of affiliateRows) {
      console.log(`    ${String(partner ?? 'unknown').padEnd(10)} ${fmtNum(clicks)}`);
    }
    const adViews = posthog.adSlots?.results?.[0]?.[0] ?? 0;
    console.log(`  Ad slot views:    ${fmtNum(adViews)}`);
    console.log('');
  }

  console.log('--- AD NETWORK CONTEXT ---');
  const sessions = ga4Sessions ?? phSessions;
  if (sessions != null) {
    console.log(`  Current monthly sessions: ${fmtNum(sessions)}`);
    console.log(`  AdSense:           eligible`);
    const journey = 10000 - sessions;
    console.log(`  Mediavine Journey: ${journey > 0 ? `${fmtNum(journey)} sessions short of 10,000` : 'eligible'}`);
    const full = 50000 - sessions;
    console.log(`  Mediavine full:    ${full > 0 ? `${fmtNum(full)} sessions short of 50,000` : 'eligible'}`);
  } else {
    console.log(`  Current monthly sessions: no data`);
    console.log(`  AdSense:           unknown`);
    console.log(`  Mediavine Journey: unknown`);
    console.log(`  Mediavine full:    unknown`);
  }
  if (ga4Pageviews != null) {
    const raptive = 100000 - ga4Pageviews;
    console.log(`  Raptive:           ${raptive > 0 ? `${fmtNum(raptive)} pageviews short of 100,000` : 'eligible'}`);
  } else {
    console.log(`  Raptive:           unknown (GA4 pageviews unavailable)`);
  }
  console.log('');
  console.log('=========================');
}

async function main() {
  const now = new Date();
  const generatedAt = now.toISOString();
  const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const windowStart = ymd(start);
  const windowEnd = ymd(now);

  const [ga4, posthog] = await Promise.all([
    fetchGA4().catch((err) => {
      console.warn(`[GA4] Failed: ${err.message}`);
      return null;
    }),
    fetchPostHog().catch((err) => {
      console.warn(`[PostHog] Failed: ${err.message}`);
      return null;
    }),
  ]);

  printSummary({ generatedAt, windowStart, windowEnd, ga4, posthog });

  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  const outPath = path.join(SNAPSHOT_DIR, `snapshot-${ymd(now)}.json`);
  const snapshot = {
    generated_at: generatedAt,
    window: { start: windowStart, end: windowEnd },
    ga4,
    posthog,
  };
  fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2));
  console.log(`Snapshot written to ${path.relative(process.cwd(), outPath)}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
