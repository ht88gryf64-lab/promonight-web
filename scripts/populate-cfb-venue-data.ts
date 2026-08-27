// Pass 2 of the CFB venue sourcing work (audit/cfb-venue-sourcing-report.md,
// section 8): plan-driven writes to venueHubs and their tenant overlays.
//
// Usage:
//   tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs \
//     scripts/populate-cfb-venue-data.ts [--plan scripts/cfb-venue-data-plan.json]            # dry-run (default)
//   tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs \
//     scripts/populate-cfb-venue-data.ts --execute                                            # snapshot + write
//
// Write discipline:
//   - Every field in the plan carries its own source URL; the script writes the
//     value AND the provenance key together, never one without the other.
//     Provenance keys follow the data's two conventions: dotted sub-keys for
//     tailgating.* and publicTransit.* (sources["tailgating.rules"]), the flat
//     field name for everything else (sources.accessibility, overlay
//     sources.gatesOpen).
//   - A populated field is never overwritten unless the plan entry says
//     overwrite: true (Maryland publicTransit.notes, Army verifyNotes). The
//     dry-run lists every overwrite separately so it can be reviewed.
//   - Nothing is ever deleted. A superseded note is kept in the record with a
//     SUPERSEDED marker, not removed.
//   - --execute snapshots each touched hub doc and its tenant overlays in FULL
//     to scripts/snapshots/cfb-venue-data-pre-<stamp>.json before the first
//     write; restore is a set() of the snapshot.
//   - Writes use update() with FieldPath segments so a literal dotted key in
//     the sources map ("tailgating.rules") is one key, not a nested path.
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { FieldPath } from 'firebase-admin/firestore';
import { db } from '../src/lib/firebase';

interface PlanField { path: string; value: unknown; source: string; overwrite?: boolean; note?: string }
interface PlanOverlay { teamId: string; fields: PlanField[] }
interface PlanEntry { hub: string; note?: string; fields: PlanField[]; overlay?: PlanOverlay }

const SUB_KEYED = /^(tailgating|publicTransit)\./;
/** Internal record fields: no user-facing copy rules, no provenance key. */
const INTERNAL = new Set(['verifyNotes']);
const OFFICIAL_HOST = /^(https?:\/\/)([a-z0-9-]+\.)*(edu|com|org|gov|net)(\/|$)/i;

/** Where the provenance for a written path lives in the sources map. */
function sourceKey(path: string): string {
  if (SUB_KEYED.test(path)) return path; // dotted convention, literal key
  return path.split('.')[0]; // flat field name (gatesOpen.ruleText -> gatesOpen)
}
const segs = (path: string) => path.split('.');
const getAt = (doc: Record<string, unknown>, path: string): unknown => segs(path).reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), doc);
const populated = (v: unknown): boolean => v !== null && v !== undefined && !(typeof v === 'string' && !v.trim()) && !(Array.isArray(v) && v.length === 0);
const hasEmDash = (v: unknown): boolean => JSON.stringify(v).includes('—');

async function main() {
  const execute = process.argv.includes('--execute');
  const planIdx = process.argv.indexOf('--plan');
  const planPath = planIdx >= 0 ? process.argv[planIdx + 1] : join(__dirname, 'cfb-venue-data-plan.json');
  const plan: PlanEntry[] = JSON.parse(readFileSync(planPath, 'utf8'));
  console.log(`[cfb-venue-data] mode: ${execute ? 'EXECUTE' : 'DRY-RUN'}; plan: ${planPath}; hubs: ${plan.length}`);

  // Validate the plan before touching Firestore.
  let problems = 0;
  for (const e of plan) {
    const all = [...e.fields.map((f) => ({ ...f, where: e.hub })), ...(e.overlay?.fields ?? []).map((f) => ({ ...f, where: `${e.hub}/tenants/${e.overlay!.teamId}` }))];
    for (const f of all) {
      const internal = INTERNAL.has(f.path);
      if (!internal && (!f.source || !OFFICIAL_HOST.test(f.source))) { console.error(`  PLAN ERROR ${f.where} ${f.path}: missing or malformed source "${f.source}"`); problems++; }
      if (f.value === null || f.value === undefined) { console.error(`  PLAN ERROR ${f.where} ${f.path}: null value (the script never deletes)`); problems++; }
      if (!internal && hasEmDash(f.value)) { console.error(`  PLAN ERROR ${f.where} ${f.path}: em dash in value`); problems++; }
    }
  }
  if (problems) { console.error(`[cfb-venue-data] ${problems} plan problem(s); nothing written.`); process.exit(1); }

  // Read current state, build the diff.
  type Op = { ref: FirebaseFirestore.DocumentReference; label: string; updates: Array<[FieldPath, unknown]>; seen: Map<string, unknown>; lines: string[] };
  let conflicts = 0;
  /** Add one field-path update, collapsing an exact duplicate and refusing a
   *  contradictory one. Firestore rejects a repeated field path outright. */
  const push = (op: Op, path: string[], value: unknown, where?: string) => {
    const k = path.join('\u0000');
    if (op.seen.has(k)) {
      if (JSON.stringify(op.seen.get(k)) !== JSON.stringify(value)) { console.error(`  PLAN ERROR ${where ?? op.label}: ${path.join('.')} set twice with different values`); conflicts++; }
      return;
    }
    op.seen.set(k, value);
    op.updates.push([new FieldPath(...path), value]);
  };
  const ops: Op[] = [];
  const snapshot: Record<string, unknown> = {};
  let writes = 0, overwrites = 0, refused = 0, skippedSame = 0;
  for (const e of plan) {
    const hubRef = db.collection('venueHubs').doc(e.hub);
    const hubSnap = await hubRef.get();
    if (!hubSnap.exists) { console.error(`  MISSING hub ${e.hub}; skipped`); refused += e.fields.length; continue; }
    const hub = hubSnap.data() as Record<string, unknown>;
    snapshot[`venueHubs/${e.hub}`] = hub;
    const targets: Array<{ ref: FirebaseFirestore.DocumentReference; label: string; doc: Record<string, unknown>; fields: PlanField[] }> = [{ ref: hubRef, label: e.hub, doc: hub, fields: e.fields }];
    if (e.overlay) {
      const tRef = hubRef.collection('tenants').doc(e.overlay.teamId);
      const tSnap = await tRef.get();
      if (!tSnap.exists) { console.error(`  MISSING overlay ${e.hub}/tenants/${e.overlay.teamId}; skipped`); refused += e.overlay.fields.length; }
      else { const t = tSnap.data() as Record<string, unknown>; snapshot[`venueHubs/${e.hub}/tenants/${e.overlay.teamId}`] = t; targets.push({ ref: tRef, label: `${e.hub}/tenants/${e.overlay.teamId}`, doc: t, fields: e.overlay.fields }); }
    }
    for (const t of targets) {
      const op: Op = { ref: t.ref, label: t.label, updates: [], seen: new Map(), lines: [] };
      const sources = (t.doc.sources ?? {}) as Record<string, unknown>;
      for (const f of t.fields) {
        const cur = getAt(t.doc, f.path);
        const internal = INTERNAL.has(f.path);
        const sk = sourceKey(f.path);
        const curSrc = internal ? undefined : sources[sk];
        const same = JSON.stringify(cur) === JSON.stringify(f.value) && (internal || curSrc === f.source);
        if (same) { skippedSame++; op.lines.push(`    = ${f.path} (already identical, with source)`); continue; }
        if (populated(cur) && JSON.stringify(cur) !== JSON.stringify(f.value) && !f.overwrite) { refused++; op.lines.push(`    ! REFUSED ${f.path}: populated (${JSON.stringify(cur).slice(0, 80)}) and plan lacks overwrite:true`); continue; }
        if (populated(cur) && JSON.stringify(cur) !== JSON.stringify(f.value)) { overwrites++; op.lines.push(`    ~ OVERWRITE ${f.path}\n        was: ${JSON.stringify(cur).slice(0, 300)}\n        now: ${JSON.stringify(f.value).slice(0, 300)}${internal ? '' : `\n        source ${curSrc ?? '(none)'} -> ${f.source}`}`); }
        else op.lines.push(`    + ${f.path} = ${JSON.stringify(f.value).slice(0, 300)}\n        source: ${f.source}${f.note ? `\n        note: ${f.note}` : ''}`);
        push(op, segs(f.path), f.value);
        // Two sub-fields of one field (gatesOpen.ruleText + gatesOpen.minutesBefore)
        // share a single flat provenance key. Firestore rejects an update that
        // names the same field path twice, so collapse them; a genuine
        // disagreement (same key, two different sources) is a plan error.
        if (!internal) push(op, ['sources', sk], f.source, `${t.label} ${f.path}`);
        writes++;
      }
      ops.push(op);
    }
  }

  for (const op of ops) { console.log(`\n  ${op.label}`); for (const l of op.lines) console.log(l); }
  console.log(`\n  fields ${execute ? 'written' : 'to write'}: ${writes} (of which overwrites: ${overwrites}); identical/skipped: ${skippedSame}; refused: ${refused}`);
  if (refused) { console.error('[cfb-venue-data] refused entries present; fix the plan before --execute.'); if (execute) process.exit(1); }
  if (conflicts) { console.error(`[cfb-venue-data] ${conflicts} contradictory field path(s); nothing written.`); process.exit(1); }
  if (!execute) { console.log('\n[cfb-venue-data] DRY-RUN complete. Re-run with --execute to snapshot + write.'); process.exit(0); }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const snapPath = join(__dirname, 'snapshots', `cfb-venue-data-pre-${stamp}.json`);
  writeFileSync(snapPath, JSON.stringify(snapshot, null, 2));
  console.log(`\n[cfb-venue-data] snapshot written: ${snapPath}`);
  for (const op of ops) {
    if (!op.updates.length) continue;
    const flat: unknown[] = [];
    for (const [fp, v] of op.updates) flat.push(fp, v);
    await op.ref.update(flat[0] as FieldPath, flat[1], ...flat.slice(2));
    console.log(`  wrote ${op.label} (${op.updates.length} field paths incl. sources)`);
  }
  console.log('[cfb-venue-data] EXECUTE complete.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
