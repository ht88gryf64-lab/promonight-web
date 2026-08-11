import type { Metadata } from 'next';
import { getAllMatchupSlugs } from '@/lib/cfb/matchups';

export const revalidate = 21600; // ISR, same cadence as the CFB hub

export const metadata: Metadata = {
  // Hardcoded season year by house rule: never getFullYear() in SEO copy, bump
  // deliberately when next-season content is ready.
  title: 'College Football Rivalries 2026',
  description:
    'Every major college football rivalry in 2026: the date, the kickoff, the stadium and how to plan the trip.',
};

export default async function Page() {
  // SCAFFOLD ONLY. Phase 1D builds the real index: chronological, all 30, each
  // row showing rivalry name, date and both schools. It is the breadcrumb
  // destination for every matchup page, so it ships before the family is linked.
  const slugs = getAllMatchupSlugs();
  void slugs;
  return null;
}
