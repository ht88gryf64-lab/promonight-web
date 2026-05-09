// Idempotently provisions Phase 0 dashboard tiles on the "PromoNight-Web"
// PostHog dashboard. Re-run safely: tiles whose `name` already exists on the
// target dashboard are skipped, no duplicates created.
//
// Required env (loaded via tsx --env-file=.env.local):
//   POSTHOG_HOST              e.g. https://us.i.posthog.com
//   POSTHOG_PROJECT_ID        numeric project id (e.g. 393054)
//   POSTHOG_PERSONAL_API_KEY  personal API key with scopes:
//                             insight:write, dashboard:read, dashboard:write
//
// Run:  npm run posthog:provision

const REQUIRED_ENV = [
  'POSTHOG_HOST',
  'POSTHOG_PROJECT_ID',
  'POSTHOG_PERSONAL_API_KEY',
] as const;

type EnvKey = (typeof REQUIRED_ENV)[number];
type Env = Record<EnvKey, string>;

const DASHBOARD_ID = 1498944;

// ── Tile specifications ──────────────────────────────────────────────────
// Tile 8 from the original spec is intentionally omitted: the existing
// "Travel-planner thesis: away expansion %" tile already measures
// away_game_expanded / game_tap.
//
// Uses the modern InsightVizNode `query` shape — this project has legacy
// `filters` POSTs disabled at the org level.

type PropertyFilter = {
  key: string;
  type: 'event';
  value: string;
  operator: 'exact';
};

type EventsNode = {
  kind: 'EventsNode';
  event: string;
  name: string;
  math?: 'total';
  properties?: PropertyFilter[];
};

const trendsEvent = (event: string, properties?: PropertyFilter[]): EventsNode => ({
  kind: 'EventsNode',
  event,
  name: event,
  math: 'total',
  ...(properties ? { properties } : {}),
});

const funnelEvent = (event: string): EventsNode => ({
  kind: 'EventsNode',
  event,
  name: event,
});

type Breakdown = { type: 'event'; property: string };

type TrendsQuery = {
  kind: 'TrendsQuery';
  series: EventsNode[];
  interval: 'day';
  dateRange: { date_from: string };
  trendsFilter: { display: string; formula?: string };
  breakdownFilter?: { breakdowns: Breakdown[]; breakdown_limit?: number };
};

type FunnelsQuery = {
  kind: 'FunnelsQuery';
  series: EventsNode[];
  dateRange: { date_from: string };
  funnelsFilter: {
    funnelVizType: 'steps';
    funnelWindowInterval?: number;
    funnelWindowIntervalUnit?: 'day';
  };
};

type InsightQuery = {
  kind: 'InsightVizNode';
  source: TrendsQuery | FunnelsQuery;
};

type TileSpec = {
  name: string;
  description: string;
  query: InsightQuery;
};

const TILES: TileSpec[] = [
  {
    name: 'Affiliate clicks by surface',
    description:
      'Daily affiliate_click count broken down by surface (web_home, web_team_page, web_playoffs, web_promo_detail, ...). Identifies which page converts best.',
    query: {
      kind: 'InsightVizNode',
      source: {
        kind: 'TrendsQuery',
        series: [trendsEvent('affiliate_click')],
        interval: 'day',
        dateRange: { date_from: '-30d' },
        trendsFilter: { display: 'ActionsLineGraph' },
        breakdownFilter: { breakdowns: [{ type: 'event', property: 'surface' }] },
      },
    },
  },
  {
    name: 'Conversion funnel: pageview to engagement to affiliate click',
    description:
      'End-to-end monetization funnel. page_view -> team_page_engaged -> affiliate_click within a 1-day window.',
    query: {
      kind: 'InsightVizNode',
      source: {
        kind: 'FunnelsQuery',
        series: [
          funnelEvent('page_view'),
          funnelEvent('team_page_engaged'),
          funnelEvent('affiliate_click'),
        ],
        dateRange: { date_from: '-30d' },
        funnelsFilter: {
          funnelVizType: 'steps',
          funnelWindowInterval: 1,
          funnelWindowIntervalUnit: 'day',
        },
      },
    },
  },
  {
    name: 'AI referral traffic over time',
    description:
      'Daily page_view count where source_medium = ai, broken down by source host (chatgpt.com, perplexity.ai, claude.ai, gemini.google.com, ...). ROI scorecard for the AI Citation Doctrine.',
    query: {
      kind: 'InsightVizNode',
      source: {
        kind: 'TrendsQuery',
        series: [
          trendsEvent('page_view', [
            { key: 'source_medium', type: 'event', value: 'ai', operator: 'exact' },
          ]),
        ],
        interval: 'day',
        dateRange: { date_from: '-30d' },
        trendsFilter: { display: 'ActionsLineGraph' },
        breakdownFilter: { breakdowns: [{ type: 'event', property: 'source' }] },
      },
    },
  },
  {
    name: 'Top entry pages by session',
    description:
      'Top 10 page_path values by total page_view count over the last 30 days. Surfaces SEO winners.',
    query: {
      kind: 'InsightVizNode',
      source: {
        kind: 'TrendsQuery',
        series: [trendsEvent('page_view')],
        interval: 'day',
        dateRange: { date_from: '-30d' },
        trendsFilter: { display: 'ActionsBarValue' },
        breakdownFilter: {
          breakdowns: [{ type: 'event', property: 'page_path' }],
          breakdown_limit: 10,
        },
      },
    },
  },
  {
    name: 'Mobile vs desktop affiliate click rate',
    description:
      'Daily affiliate_click count broken down by $device_type (PostHog auto-property). Reveals device-skewed CTA performance.',
    query: {
      kind: 'InsightVizNode',
      source: {
        kind: 'TrendsQuery',
        series: [trendsEvent('affiliate_click')],
        interval: 'day',
        dateRange: { date_from: '-30d' },
        trendsFilter: { display: 'ActionsBar' },
        breakdownFilter: { breakdowns: [{ type: 'event', property: '$device_type' }] },
      },
    },
  },
  {
    name: 'Promo card tap rate per pageview',
    description:
      'promo_card_tap / page_view, displayed as a percentage per day. Distinguishes content vs UX problems.',
    query: {
      kind: 'InsightVizNode',
      source: {
        kind: 'TrendsQuery',
        series: [trendsEvent('promo_card_tap'), trendsEvent('page_view')],
        interval: 'day',
        dateRange: { date_from: '-30d' },
        trendsFilter: { display: 'ActionsLineGraph', formula: 'A / B * 100' },
      },
    },
  },
  {
    name: 'App download click rate',
    description:
      'app_download_click / page_view, displayed as a percentage per day. Web-to-app funnel KPI.',
    query: {
      kind: 'InsightVizNode',
      source: {
        kind: 'TrendsQuery',
        series: [trendsEvent('app_download_click'), trendsEvent('page_view')],
        interval: 'day',
        dateRange: { date_from: '-30d' },
        trendsFilter: { display: 'ActionsLineGraph', formula: 'A / B * 100' },
      },
    },
  },
];

// ── Env / HTTP helpers ───────────────────────────────────────────────────

function loadEnv(): Env {
  const missing: string[] = [];
  const out: Partial<Env> = {};
  for (const key of REQUIRED_ENV) {
    const value = process.env[key];
    if (!value) missing.push(key);
    else out[key] = value;
  }
  if (missing.length > 0) {
    console.error(
      `Missing required env: ${missing.join(', ')}. Add them to .env.local and re-run.`,
    );
    process.exit(1);
  }
  return out as Env;
}

async function ph(env: Env, path: string, init?: RequestInit): Promise<Response> {
  const host = env.POSTHOG_HOST.replace(/\/$/, '');
  const url = `${host}/api/projects/${env.POSTHOG_PROJECT_ID}${path}`;
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.POSTHOG_PERSONAL_API_KEY}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
}

// ── Dashboard read / insight create ──────────────────────────────────────

async function fetchExistingTileNames(env: Env): Promise<Set<string>> {
  const res = await ph(env, `/dashboards/${DASHBOARD_ID}/`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `GET /dashboards/${DASHBOARD_ID}/ failed: HTTP ${res.status} — ${body.slice(0, 500)}`,
    );
  }
  const json = (await res.json()) as {
    name?: string;
    tiles?: Array<{ insight?: { name?: string; derived_name?: string } | null }>;
  };
  const names = new Set<string>();
  for (const tile of json.tiles ?? []) {
    const n = tile.insight?.name?.trim() || tile.insight?.derived_name?.trim();
    if (n) names.add(n);
  }
  return names;
}

async function createInsight(env: Env, spec: TileSpec): Promise<number> {
  const body = {
    name: spec.name,
    description: spec.description,
    query: spec.query,
    dashboards: [DASHBOARD_ID],
  };
  const res = await ph(env, '/insights/', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `POST /insights/ failed for "${spec.name}": HTTP ${res.status} — ${text.slice(0, 800)}`,
    );
  }
  const json = (await res.json()) as { id?: number };
  if (typeof json.id !== 'number') {
    throw new Error(`POST /insights/ for "${spec.name}" returned no numeric id`);
  }
  return json.id;
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const env = loadEnv();
  console.log(
    `PostHog provisioning: project=${env.POSTHOG_PROJECT_ID} dashboard=${DASHBOARD_ID}`,
  );
  console.log(`Tiles to provision: ${TILES.length}`);

  const existing = await fetchExistingTileNames(env);
  console.log(`Existing tiles on dashboard: ${existing.size}`);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const spec of TILES) {
    if (existing.has(spec.name)) {
      console.log(`  skipped: "${spec.name}" (already exists)`);
      skipped += 1;
      continue;
    }
    try {
      const id = await createInsight(env, spec);
      console.log(`  created: "${spec.name}" (insight_id=${id})`);
      created += 1;
    } catch (err) {
      console.error(`  failed:  "${spec.name}" — ${(err as Error).message}`);
      failed += 1;
    }
  }

  console.log('---');
  console.log(`Summary: created=${created}, skipped=${skipped}, failed=${failed}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error((err as Error).message ?? err);
  process.exit(1);
});
