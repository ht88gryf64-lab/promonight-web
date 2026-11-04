// Every TicketmasterCTA / TicketsBlock call site either passes the
// tnHomeUnavailable switch (ticketNetwork={ticketNetworkForGame(...)}) or is a
// listed exception: the playoffs primaryOnly button (Ticketmaster, falling back
// to TicketNetwork only if the Ticketmaster link cannot be built; the flagged
// clubs all have Ticketmaster ids) and CFB schools (never in tnTeamMap). Since 2026-11-03 the
// team-page hero and sidebar are switched too (Matt: Ticketmaster only there
// for a flagged club). A new call site fails here until it is put on one list or the
// other (review M1, 2026-11-03).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(process.cwd(), 'src');
// file -> number of call sites that are team-level by design.
const TEAM_LEVEL: Record<string, number> = {
  'components/playoffs/tickets.tsx': 1, // primaryOnly: Ticketmaster is the only button rendered
  'components/cfb/CfbSchedule.tsx': 1, // CFB schools are not in tnTeamMap
  'components/cfb/CfbSchoolPage.tsx': 2,
};

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === '__tests__' ? [] : files(p);
    return /\.tsx$/.test(n) ? [p] : [];
  });
}

test('every ticket CTA call site is switched or listed as team-level', () => {
  const seen: Record<string, { sites: number; switched: number }> = {};
  for (const f of files(ROOT)) {
    const rel = relative(ROOT, f);
    if (rel.startsWith('components/affiliates/')) continue;
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/<(TicketmasterCTA|TicketsBlock)\b([\s\S]*?)\/>/g)) {
      const s = (seen[rel] ??= { sites: 0, switched: 0 });
      s.sites += 1;
      if (/ticketNetwork=\{ticketNetworkForGame\(/.test(m[2])) s.switched += 1;
    }
  }
  for (const [rel, s] of Object.entries(seen)) {
    assert.equal(s.sites - s.switched, TEAM_LEVEL[rel] ?? 0, `${rel}: ${s.sites} site(s), ${s.switched} switched; unswitched sites must be listed as team-level`);
  }
  for (const rel of Object.keys(TEAM_LEVEL)) assert.ok(seen[rel], `${rel} is listed but has no call site`);
});
