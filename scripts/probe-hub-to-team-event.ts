/* eslint-disable no-console */
export {}; // module scope (this file has only a dynamic import, so mark it a module)
// Executable firing test for the hub_to_team event. Stubs the minimum browser
// globals track() reads, then calls track('hub_to_team', <the exact payload the
// HubTeamLink mousedown handler sends>) and asserts BOTH sinks fire: PostHog
// (window.posthog.capture) and GA4 (window.gtag). No browser, no network.

type Call = { name: string; props: unknown };
const phCalls: Call[] = [];
const gaCalls: Call[] = [];

const mem = () => {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
};

const win = {
  location: { pathname: '/venues/metlife-stadium', search: '' },
  innerWidth: 1200,
  localStorage: mem(),
  sessionStorage: mem(),
  posthog: { capture: (name: string, props: unknown) => phCalls.push({ name, props }) },
  gtag: (kind: string, name: string, props: unknown) => {
    if (kind === 'event') gaCalls.push({ name, props });
  },
};

const g = globalThis as unknown as Record<string, unknown>;
g.window = win;
g.document = { cookie: '', referrer: '' };
g.localStorage = win.localStorage;
g.sessionStorage = win.sessionStorage;
// navigator is a read-only global in Node; the real one (userAgent set) is fine.

async function main() {
  const { track } = await import('../src/lib/analytics');
  // The exact payload HubTeamLink fires (Giants row on the MetLife hub).
  track('hub_to_team', {
    surface: 'web_venue',
    team_slug: 'new-york-giants',
    sport: 'nfl',
    placement: 'venue_hub_teams_block',
    building_slug: 'metlife-stadium',
    building_name: 'MetLife Stadium',
    destination_url: '/nfl/new-york-giants',
  });

  const ph = phCalls.find((c) => c.name === 'hub_to_team');
  const ga = gaCalls.find((c) => c.name === 'hub_to_team');
  console.log('PostHog capture fired :', !!ph);
  console.log('GA4 gtag event fired  :', !!ga);
  console.log('PostHog payload       :', JSON.stringify(ph?.props));
  const ok = !!ph && !!ga;
  console.log(ok ? '\nRESULT: PASS (dual-emit fires)' : '\nRESULT: FAIL');
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
