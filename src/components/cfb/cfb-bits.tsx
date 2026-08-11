// Shared, presentational CFB bits used by BOTH the server team page
// (CfbSchoolPage) and the client schedule/modal (CfbSchedule). No hooks / no
// client-only APIs, so it renders correctly in either context. Extracted so the
// date formatters + the trophy tag are a single source across the two files.

import Link from 'next/link';
import { matchupEntryForRivalryId } from '@/lib/cfb/matchup-registry';
import { resolveMatchupDisplayName } from '@/lib/cfb/display-name';
import type { ReactNode } from 'react';
import type { CfbGameView } from '@/lib/cfb/data';

export const SERIF = 'var(--font-cfb-serif), Georgia, serif';
export const MONO = 'var(--font-mono), ui-monospace, monospace';
export const SANS = 'var(--font-outfit), system-ui, sans-serif';

export type RivalryTag = NonNullable<CfbGameView['rivalry']>;

export function fmtMonthDay(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
}
export function fmtDayLong(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  const wd = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  return `${wd} · ${fmtMonthDay(iso)}`;
}

// Trophy/rivalry tag — FACT, crown none. Links to the trophy's OWN Wikipedia
// article (stored corroborating source) in a new tab; plain <span> when no valid
// source URL is stored (never a broken link). Same pill treatment either way.
export function TrophyTag({ rivalry, tiny }: { rivalry: RivalryTag; tiny?: boolean }) {
  // The RIVALRY NAME is the visible text, not the trophy. The name is the term
  // people search; the trophy was in the tooltip. Resolved through the registry
  // so a school page and its matchup page never disagree about what a rivalry is
  // called (Okefenokee Oar renders as "Florida vs Georgia" in both places).
  const entry = matchupEntryForRivalryId(rivalry.id);
  const label = resolveMatchupDisplayName(entry, rivalry.name);
  const title = rivalry.trophy && rivalry.trophy !== label ? `${label} · ${rivalry.trophy}` : label;
  const cls = `rounded-full px-2 py-0.5 ${tiny ? 'text-[9px]' : 'text-[10px]'} font-bold uppercase`;
  const style = { fontFamily: MONO, letterSpacing: '0.03em', background: 'var(--cfb-accent)', color: 'var(--cfb-accent-ink)' };

  // Where we have a matchup page, send people there: same tab, internal link.
  // Where we do not, the Wikipedia link stays exactly as it was. The external
  // link is not removed as a class of behaviour, only superseded where we have
  // somewhere better to send someone.
  if (entry) {
    return (
      <Link href={`/cfb/rivalries/${entry.slug}`} title={title} className={`${cls} transition-opacity hover:opacity-80`} style={style}>
        {label}
      </Link>
    );
  }
  if (rivalry.sourceUrl) {
    return (
      <a
        href={rivalry.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={`${title} · Wikipedia`}
        className={`${cls} transition-opacity hover:opacity-80`}
        style={style}
      >
        {label}
      </a>
    );
  }
  return <span className={cls} style={style} title={title}>{label}</span>;
}

// Accent-colored mono section label (+ optional right-aligned meta), mockup style.
export function Eyebrow({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-3">
      <div className="text-[12px] font-normal uppercase" style={{ fontFamily: MONO, letterSpacing: '0.166em', color: 'var(--cfb-accent)' }}>
        {children}
      </div>
      {right && (
        <div className="shrink-0 text-[10px] uppercase text-white/35" style={{ fontFamily: MONO, letterSpacing: '0.1em' }}>
          {right}
        </div>
      )}
    </div>
  );
}
