import Link from 'next/link';

// The archive's own 404 (step 6, ux-review): a real club with nothing played
// yet is not a missing team, so the not-found boundary here says what is
// true instead of the team-level "TEAM NOT FOUND". The status is 404; the
// page is noindex by the boundary's nature.
export default function PastPromosNotFound() {
  return (
    <article className="mx-auto w-full max-w-[640px] px-4 pb-10 lg:max-w-3xl">
      <header className="flex flex-col gap-2 pt-10">
        <h1 className="rd-display m-0 text-[30px] uppercase leading-[1.02] text-rd-ink">No past promos yet</h1>
        <p className="m-0 text-[15px] leading-[1.55] text-rd-ink-soft">This club has no completed promotion on record. Its upcoming promos are on the team page.</p>
      </header>
      <p className="mt-6 flex flex-wrap gap-x-4 gap-y-1 font-rd text-[14px] font-medium">
        <Link href="/teams" className="inline-flex min-h-11 items-center text-rd-link no-underline hover:underline">All teams</Link>
      </p>
    </article>
  );
}
