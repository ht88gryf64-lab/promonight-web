/* eslint-disable no-console */
import {
  getVenueHub,
  getAllVenueHubSlugs,
  venueHubTitle,
  venueHubDescription,
  bagCapsule,
  displayVenueName,
  isCfbOnlyHub,
} from '../src/lib/venue-hub';

// READ-ONLY validation of the new title/description/bag-label helpers against
// live venueHubs data. No writes. Confirms the title length guard, per-building
// description budgets, and the bag-label fix across all 222 buildings.

async function main() {
  const slugs = await getAllVenueHubSlugs();
  console.log(`venueHubs: ${slugs.length}\n`);

  const focus = ['target-field', 'arrowhead-stadium', 'neyland-stadium', 'michigan-stadium', 'angel-stadium', 'gaylord-family-oklahoma-memorial-stadium'];
  console.log('=== FOCUS: title / bag-label / description ===');
  for (const slug of focus) {
    const hub = await getVenueHub(slug);
    if (!hub) { console.log(`\n${slug}: MISSING`); continue; }
    const title = venueHubTitle(hub);
    const head = title.split(' | ')[0];
    const rendered = `${title} | PromoNight`;
    const cap = bagCapsule(hub);
    const desc = venueHubDescription(hub);
    console.log(`\n${slug}  [${isCfbOnlyHub(hub) ? 'CFB' : 'PRO'}] verified=${hub.verified}`);
    console.log(`  TITLE head(${head.length}): "${head}"`);
    console.log(`  TITLE full: "${title}"`);
    console.log(`  RENDERED(${rendered.length}): "${rendered}"`);
    console.log(`  BAG cap: dims=${JSON.stringify(cap.dims)} big="${cap.bigText}" label="${cap.label}"`);
    console.log(`  DESC(${desc.length}): "${desc}"`);
  }

  // ── sweep: guard trips + label distribution + desc budget ──
  let overHead = 0;
  let overDesc = 0;
  const overHeadList: string[] = [];
  const overDescList: string[] = [];
  const labelCounts: Record<string, number> = {};
  let noBagsLabels = 0;
  const noBagsList: string[] = [];
  for (const slug of slugs) {
    const hub = await getVenueHub(slug);
    if (!hub) continue;
    const title = venueHubTitle(hub);
    const head = title.split(' | ')[0];
    if (head.length > 60) { overHead++; overHeadList.push(`${head.length} ${slug} "${head}"`); }
    const desc = venueHubDescription(hub);
    if (desc.length > 160) { overDesc++; overDescList.push(`${desc.length} ${slug}`); }
    const cap = bagCapsule(hub);
    // only count label when the bag capsule would render (verified + has bag data)
    const hasBag = hub.verified && (hub.bagMaxDimensions !== null || hub.clearBagRequired !== null || hub.bagsProhibited === true || !!hub.bagPolicyNotes);
    if (hasBag) {
      labelCounts[cap.label] = (labelCounts[cap.label] ?? 0) + 1;
      if (cap.label === 'NO BAGS ALLOWED') { noBagsLabels++; noBagsList.push(slug); }
    }
  }
  console.log(`\n\n=== SWEEP (all ${slugs.length}) ===`);
  console.log(`title heads > 60 chars: ${overHead}`);
  overHeadList.sort((a, b) => Number(b.split(' ')[0]) - Number(a.split(' ')[0])).forEach((s) => console.log(`  ${s}`));
  console.log(`\ndescriptions > 160 chars: ${overDesc}`);
  overDescList.forEach((s) => console.log(`  ${s}`));
  console.log(`\nbag-capsule label distribution (rendering buildings only):`);
  Object.entries(labelCounts).forEach(([k, v]) => console.log(`  ${k.padEnd(20)} ${v}`));
  console.log(`\n"NO BAGS ALLOWED" now shown on ${noBagsLabels} verified buildings: ${JSON.stringify(noBagsList)}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
