import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCfbSchool } from '@/lib/cfb/data';
import { resolveCfbTheme, cfbThemeVars } from '@/lib/cfb/theme';
import { archivo } from '@/components/redesign/fonts';
import { ContributeForm } from '@/components/cfb/ContributeForm';
import type { CSSProperties } from 'react';

export const dynamic = 'force-dynamic'; // reads ?school= at request time

export const metadata: Metadata = {
  title: 'Contribute — College Football Gameday',
  robots: { index: false, follow: true }, // a submission form is not an index target
};

export default async function ContributePage({ searchParams }: { searchParams: Promise<{ school?: string }> }) {
  const { school } = await searchParams;
  const id = (school || '').toLowerCase();
  const s = id ? await getCfbSchool(id) : null;
  if (!s) notFound();

  const theme = resolveCfbTheme(s.primaryColor, s.secondaryColor);
  const vars = cfbThemeVars(theme) as CSSProperties;

  return (
    <div style={vars}>
      <main className={`min-h-screen bg-[#0b0b0d] text-white ${archivo.className}`}>
        <div className="mx-auto max-w-2xl px-4 py-8">
          <Link href={`/cfb/${s.id}`} className="text-sm text-white/50 hover:text-white">← {s.name}</Link>
          <div className="mt-4 h-1 w-16 rounded" style={{ background: 'var(--cfb-accent)' }} />
          <h1 className="mt-3 text-3xl font-extrabold">Tell the story of a {s.shortName} Saturday</h1>
          <p className="mt-2 text-white/70">You know this place. Help the next person plan the trip — the traditions, the tailgate, why you go. Written by people who actually go, credited to you.</p>
          <div className="mt-8">
            <ContributeForm schoolId={s.id} schoolName={s.shortName} />
          </div>
        </div>
      </main>
    </div>
  );
}
