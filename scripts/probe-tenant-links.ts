/* eslint-disable no-console */
import {
  getVenueHub,
  getAllVenueHubSlugs,
  resolveTenantTeamLinks,
} from '../src/lib/venue-hub';

// READ-ONLY validation of the hub -> team return links. Resolves every tenant of
// every building to its team/school page and reports any tenant whose page does
// NOT resolve (a would-be 404 that the UI skips). Also dumps the gate buildings.

async function main() {
  const slugs = await getAllVenueHubSlugs();
  console.log(`venueHubs: ${slugs.length}\n`);

  const focus = ['arrowhead-stadium', 'metlife-stadium', 'madison-square-garden', 'gillette-stadium', 'neyland-stadium'];
  console.log('=== FOCUS: resolved return links ===');
  for (const slug of focus) {
    const hub = await getVenueHub(slug);
    if (!hub) { console.log(`\n${slug}: MISSING`); continue; }
    const links = await resolveTenantTeamLinks(hub);
    console.log(`\n${slug}  (${hub.tenants.length} tenant(s) on doc, ${links.length} resolved)`);
    for (const l of links) console.log(`    -> ${l.href.padEnd(34)} "${l.name}" ${l.isCfb ? '[CFB]' : `[${l.league}]`}`);
  }

  // ── sweep: any tenant across all buildings whose page does not resolve ──
  console.log('\n\n=== SWEEP: unresolved tenants (would-be 404s, skipped by the UI) ===');
  let totalTenants = 0;
  let totalResolved = 0;
  const misses: string[] = [];
  let proResolved = 0;
  let cfbResolved = 0;
  for (const slug of slugs) {
    const hub = await getVenueHub(slug);
    if (!hub) continue;
    const uniqueTenantIds = [...new Set(hub.tenants.map((t) => t.teamId).filter(Boolean))];
    const links = await resolveTenantTeamLinks(hub);
    const resolvedIds = new Set(links.map((l) => l.teamId));
    totalTenants += uniqueTenantIds.length;
    totalResolved += links.length;
    proResolved += links.filter((l) => !l.isCfb).length;
    cfbResolved += links.filter((l) => l.isCfb).length;
    for (const id of uniqueTenantIds) {
      if (!resolvedIds.has(id)) misses.push(`${slug} -> ${id}`);
    }
  }
  console.log(`unique tenants across all buildings: ${totalTenants}`);
  console.log(`resolved to a real page:             ${totalResolved}  (pro ${proResolved}, cfb ${cfbResolved})`);
  console.log(`UNRESOLVED (404 candidates):         ${misses.length}`);
  misses.forEach((m) => console.log(`  ${m}`));
  console.log(`\nbuildings with >=1 return link: ${'(counted below)'}`);
  let withLinks = 0;
  for (const slug of slugs) {
    const hub = await getVenueHub(slug);
    if (!hub) continue;
    const links = await resolveTenantTeamLinks(hub);
    if (links.length) withLinks++;
  }
  console.log(`  ${withLinks} / ${slugs.length}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
