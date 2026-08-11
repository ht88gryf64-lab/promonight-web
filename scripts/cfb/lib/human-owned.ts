// Firestore-side guards for the human-owned fields. The pure allowlist and the
// field picker live in src/lib/cfb/human-owned.ts so the app and the tests share
// one definition; this module adds only the parts that touch the database.

import { HUMAN_OWNED_FIELDS, pickHumanOwned } from '../../../src/lib/cfb/human-owned';

export { HUMAN_OWNED_FIELDS, pickHumanOwned };

/** One doc that would lose human-owned data if the collection were wiped. */
export interface HumanOwnedHit {
  collection: string;
  docId: string;
  fields: Record<string, unknown>;
}

/** Scan collections for docs carrying human-owned fields. Read only. */
export async function findHumanOwnedDocs(
  db: FirebaseFirestore.Firestore,
  collections: string[],
): Promise<HumanOwnedHit[]> {
  const hits: HumanOwnedHit[] = [];
  for (const col of collections) {
    const snap = await db.collection(col).get();
    for (const d of snap.docs) {
      const fields = pickHumanOwned(d.data());
      if (Object.keys(fields).length) hits.push({ collection: col, docId: d.id, fields });
    }
  }
  return hits;
}

/** Refuse a destructive wipe while human-owned data is present.
 *  Preservation cannot defend a wipe: once the docs are gone there is nothing
 *  left to read the fields back from. The only safe answer is to stop. */
export async function assertWipeSafe(
  db: FirebaseFirestore.Firestore,
  collections: string[],
  force: boolean,
): Promise<void> {
  const hits = await findHumanOwnedDocs(db, collections);
  if (!hits.length) return;

  const lines = hits.map((h) => `    ${h.collection}/${h.docId}  ${JSON.stringify(h.fields)}`);
  if (force) {
    console.log('');
    console.log('!!! FORCE WIPE: destroying human-owned data on the following docs !!!');
    lines.forEach((l) => console.log(l));
    console.log(`!!! ${hits.length} doc(s) will lose fields that no re-run can rebuild !!!`);
    console.log('');
    return;
  }

  throw new Error(
    [
      '',
      `REFUSING TO WIPE: ${hits.length} doc(s) carry human-owned fields that a re-run cannot rebuild.`,
      ...lines,
      '',
      'These fields are researched or decided by hand, not parsed. Wiping them loses work silently.',
      'Options:',
      '  1. Run scoped instead (--only=<school> or --resume), which skips the wipe and preserves these fields.',
      '  2. Re-apply the data after the run.',
      '  3. Pass --force-wipe to destroy them anyway. This is logged loudly and is not reversible.',
      '',
    ].join('\n'),
  );
}
