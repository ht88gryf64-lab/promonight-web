import type { Metadata } from 'next';
import Link from 'next/link';
import { getMatchupIndexRows } from '@/lib/cfb/matchups';
import { buildCfbRivalryIndexMetadata } from '@/lib/cfb/metadata';

export const revalidate = 21600; // ISR, same cadence as the CFB hub

// Hardcoded season year by house rule: never getFullYear() in SEO copy, bump
// deliberately when next-season content is ready. Moved into the shared builder
// so this page picks up the canonical and self-referencing og:url it shipped
// without; the title and description are unchanged.
export const metadata: Metadata = buildCfbRivalryIndexMetadata();

function monthDay(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default async function Page() {
  const rows = await getMatchupIndexRows();
  const dated = rows.filter((r) => r.date).sort((a, b) => a.date!.localeCompare(b.date!));
  const undated = rows.filter((r) => !r.date);

  return (
    <main className="min-h-screen text-white" style={{ background: '#08070d' }}>
      <div className="mx-auto max-w-2xl px-4 pb-16 pt-4">
        <nav aria-label="Breadcrumb" className="text-[11px] uppercase tracking-wider text-white/45">
          <Link href="/cfb" className="hover:text-white">College Football</Link>
        </nav>
        <h1 className="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl">College Football Rivalries 2026</h1>
        <p className="mt-2 text-sm text-white/60">
          The date, the kickoff and the stadium for every rivalry we cover, in the order they are played.
        </p>

        <ul className="mt-6 space-y-2">
          {[...dated, ...undated].map((r) => (
            <li key={r.slug}>
              <Link
                href={`/cfb/rivalries/${r.slug}`}
                className="flex items-baseline justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3 transition-colors hover:bg-white/[0.06]"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{r.name}</span>
                  <span className="block text-xs text-white/50">{r.matchup}</span>
                </span>
                <span className="shrink-0 text-sm text-white/45">{r.date ? monthDay(r.date) : 'Not in 2026'}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
