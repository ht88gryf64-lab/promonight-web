'use client';

// Hero "find your team" quick-search. A client combobox that filters the 86
// teams and links straight to /cfb/{id}. The crawlable link set lives in the
// BROWSE grid below (CfbHubBrowse); this is a UX convenience on top.

import { useState } from 'react';
import Link from 'next/link';

const GOLD = '#FFB71E';

export function CfbHubSearch({ teams }: { teams: { id: string; name: string }[] }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const query = q.trim().toLowerCase();
  const matches = query === '' ? [] : teams.filter((t) => t.name.toLowerCase().includes(query)).slice(0, 8);

  return (
    <div className="relative w-full max-w-sm">
      <div className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#777" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Find your team…"
          aria-label="Find your team"
          className="w-full bg-transparent text-[14px] text-white placeholder:text-white/45 focus:outline-none"
        />
      </div>
      {open && matches.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-lg border border-white/12 bg-[#141118] shadow-2xl">
          {matches.map((t) => (
            <li key={t.id}>
              <Link href={`/cfb/${t.id}`} className="block px-4 py-2.5 text-sm text-white/85 hover:bg-white/[0.06]" style={{ borderLeft: `2px solid ${GOLD}` }}>
                {t.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
