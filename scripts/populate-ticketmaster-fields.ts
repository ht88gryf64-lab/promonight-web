/* eslint-disable no-console */
/**
 * One-shot script that populates `ticketmasterSlug` and
 * `ticketmasterAttractionId` on every team document in Firestore from
 * scripts/ticketmaster-team-mapping.json (the verified mapping merged in
 * commit 3118389).
 *
 * Usage:
 *   npm run populate:ticketmaster
 *
 * Behavior:
 *   1. Loads the mapping JSON.
 *   2. Parses every entry's URL into {slug, attractionId}. If ANY URL fails
 *      to parse, the script logs the bad URLs and exits without writing.
 *      That all-or-nothing validation prevents partial Firestore state.
 *   3. Loads all teams from Firestore once for cross-referencing.
 *   4. For each parsed entry: confirms the team doc exists, then runs
 *      `db.doc(...).update({ ticketmasterSlug, ticketmasterAttractionId })`.
 *      `update()` (not `set()`) preserves all other fields on the doc.
 *   5. Logs progress per team plus a final summary covering JSON-vs-Firestore
 *      symmetric differences.
 *
 * Fault-tolerance: per-team failures are caught and reported; a single bad
 * write doesn't abort the run. Re-running is safe — fields are overwritten
 * idempotently with the same values.
 *
 * Note on attraction id: this script writes the URL artist id (the numeric
 * segment after `/artist/`, e.g. "805972"), NOT the JSON's `attractionId`
 * field which is the Discovery API attraction id (e.g. "K8vZ9171o27"). The
 * URL builder in src/lib/affiliates.ts needs the URL-form id to construct
 * canonical-form team URLs.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

interface MappingEntry {
  attractionId: string;
  url: string;
  matchedName: string;
  confidence: string;
  notes?: string;
}

interface ParsedEntry {
  internalSlug: string;
  ticketmasterSlug: string;
  ticketmasterAttractionId: string;
  sourceUrl: string;
  confidence: string;
}

// Parses a Ticketmaster team URL into its slug + url-artist-id pair. The
// canonical form is `https://www.ticketmaster.com/{slug}-tickets/artist/{id}`.
// Anything else is rejected — caller halts the whole run on the first miss.
function parseTicketmasterUrl(
  raw: string,
): { slug: string; attractionId: string } | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.hostname !== 'www.ticketmaster.com') return null;

  const segments = u.pathname.split('/').filter(Boolean);
  if (segments.length < 3) return null;
  if (segments[1] !== 'artist') return null;

  const ticketsSegment = segments[0];
  if (!ticketsSegment.endsWith('-tickets')) return null;

  const slug = ticketsSegment.slice(0, -'-tickets'.length);
  const attractionId = segments[2];

  if (!slug || !attractionId) return null;
  return { slug, attractionId };
}

async function main() {
  // 1. Load + parse-validate the mapping JSON before touching Firestore.
  const mappingPath = join(process.cwd(), 'scripts/ticketmaster-team-mapping.json');
  const raw = readFileSync(mappingPath, 'utf8');
  const mapping = JSON.parse(raw) as Record<string, MappingEntry>;

  const slugs = Object.keys(mapping).sort();
  console.log(`Loaded ${slugs.length} entries from ${mappingPath}.`);

  const parsed: ParsedEntry[] = [];
  const parseFailures: Array<{ slug: string; url: string }> = [];

  for (const internalSlug of slugs) {
    const entry = mapping[internalSlug];
    const result = parseTicketmasterUrl(entry.url);
    if (!result) {
      parseFailures.push({ slug: internalSlug, url: entry.url });
      continue;
    }
    parsed.push({
      internalSlug,
      ticketmasterSlug: result.slug,
      ticketmasterAttractionId: result.attractionId,
      sourceUrl: entry.url,
      confidence: entry.confidence,
    });
  }

  if (parseFailures.length > 0) {
    console.error(
      `\n${parseFailures.length} URL(s) failed to parse the canonical ` +
        `\`/{slug}-tickets/artist/{id}\` shape. Aborting without writes:`,
    );
    for (const f of parseFailures) {
      console.error(`  ${f.slug}: ${f.url}`);
    }
    process.exit(1);
  }

  console.log(`All ${parsed.length} URLs parsed successfully.`);

  // 2. Connect to Firestore (deferred so the parse-validate step above runs
  //    even when Firebase Admin can't be initialized — caught early errors
  //    are easier to diagnose without the noise of a Firestore stack).
  console.log('Connecting to Firestore...');
  const { db } = await import('../src/lib/firebase');

  // 3. Load every team once. Faster than 167 individual existence checks.
  const teamsSnap = await db.collection('teams').get();
  const teamDocs = new Map<string, FirebaseFirestore.DocumentSnapshot>();
  const teamLeague = new Map<string, string>();
  const teamDisplayName = new Map<string, string>();
  for (const doc of teamsSnap.docs) {
    teamDocs.set(doc.id, doc);
    const data = doc.data();
    teamLeague.set(doc.id, typeof data?.league === 'string' ? data.league : '?');
    teamDisplayName.set(
      doc.id,
      `${typeof data?.city === 'string' ? data.city : ''} ${
        typeof data?.name === 'string' ? data.name : ''
      }`.trim(),
    );
  }
  console.log(`Loaded ${teamDocs.size} teams from Firestore.\n`);

  // 4. Per-team update with progress logging.
  const stats = {
    updated: 0,
    failed: [] as Array<{ slug: string; reason: string }>,
    notInFirestore: [] as string[],
  };

  for (let i = 0; i < parsed.length; i++) {
    const p = parsed[i];

    if (!teamDocs.has(p.internalSlug)) {
      stats.notInFirestore.push(p.internalSlug);
      console.log(
        `[${String(i + 1).padStart(3)}/${parsed.length}] (skip — not in Firestore) ${p.internalSlug}`,
      );
      continue;
    }

    const league = teamLeague.get(p.internalSlug) ?? '?';
    const displayName = teamDisplayName.get(p.internalSlug) ?? p.internalSlug;
    const label = `[${String(i + 1).padStart(3)}/${parsed.length}] ${league} ${displayName}`;

    try {
      await db.collection('teams').doc(p.internalSlug).update({
        ticketmasterSlug: p.ticketmasterSlug,
        ticketmasterAttractionId: p.ticketmasterAttractionId,
      });
      stats.updated += 1;
      console.log(
        `${label}: slug=${p.ticketmasterSlug}, attractionId=${p.ticketmasterAttractionId} ✓`,
      );
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      stats.failed.push({ slug: p.internalSlug, reason });
      console.log(`${label}: FAILED — ${reason}`);
    }
  }

  // 5. Symmetric difference: teams in Firestore but missing from the JSON.
  const jsonSlugs = new Set(parsed.map((p) => p.internalSlug));
  const firestoreOnly: string[] = [];
  for (const slug of teamDocs.keys()) {
    if (!jsonSlugs.has(slug)) firestoreOnly.push(slug);
  }

  console.log('');
  console.log('=== Summary ===');
  console.log(`Updated:                    ${stats.updated}`);
  console.log(`Failed:                     ${stats.failed.length}`);
  console.log(`In JSON but not Firestore:  ${stats.notInFirestore.length}`);
  console.log(`In Firestore but not JSON:  ${firestoreOnly.length}`);

  if (stats.failed.length > 0) {
    console.log('\nFailures:');
    for (const f of stats.failed) {
      console.log(`  ${f.slug}: ${f.reason}`);
    }
  }
  if (stats.notInFirestore.length > 0) {
    console.log('\nIn JSON but not Firestore (no doc to update — investigate):');
    for (const s of stats.notInFirestore) console.log(`  ${s}`);
  }
  if (firestoreOnly.length > 0) {
    console.log('\nIn Firestore but not JSON (won\'t have ticketmasterSlug populated):');
    for (const s of firestoreOnly) console.log(`  ${s}`);
  }

  if (stats.failed.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
