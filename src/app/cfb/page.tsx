import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { CFB_COLLECTIONS, type CfbSchool } from '@/lib/cfb/types';
import { archivo } from '@/components/redesign/fonts';

export const revalidate = 21600;

export const metadata: Metadata = {
  title: 'College Football 2026 — Schedules, Rivalries & Gameday',
  description:
    'Every 2026 college football schedule, rivalry games, and gameday info for planning a Saturday road trip. Browse all teams by conference.',
  alternates: { canonical: '/cfb' },
};

const CONF_ORDER = ['SEC', 'Big Ten', 'ACC', 'Big 12', 'Independent', 'Pac-12', 'AAC', 'Sun Belt', 'MWC', 'MAC', 'CUSA'];

// Minimal browse index. The full hub (team search, theme-games rail, road-trips,
// this-Saturday slate) is Phase 5 — this is the navigable landing so the 86 school
// pages have a home and the "← College Football" back-link resolves.
export default async function CfbIndex() {
  const snap = await db.collection(CFB_COLLECTIONS.schools).get();
  const schools = snap.docs.map((d) => d.data() as CfbSchool);
  const byConf = new Map<string, CfbSchool[]>();
  for (const s of schools) {
    const conf = s.conferenceBySeason?.['2026'] || 'Other';
    (byConf.get(conf) || byConf.set(conf, []).get(conf))!.push(s);
  }
  const confs = [...byConf.keys()].sort((a, b) => {
    const ia = CONF_ORDER.indexOf(a), ib = CONF_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  });

  return (
    <main className={`min-h-screen bg-[#0b0b0d] text-white ${archivo.className}`}>
      <div className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-3xl font-extrabold sm:text-4xl">College Football 2026</h1>
        <p className="mt-2 text-white/60">Schedules, rivalry games, and gameday info for {schools.length} teams. Pick yours.</p>
        {confs.map((conf) => (
          <section key={conf} className="mt-8">
            <h2 className="text-sm font-bold uppercase tracking-wide text-white/50">{conf}</h2>
            <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {byConf.get(conf)!.sort((a, b) => a.name.localeCompare(b.name)).map((s) => (
                <li key={s.id}>
                  <Link href={`/cfb/${s.id}`} className="block rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm hover:bg-white/[0.07]">
                    {s.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
