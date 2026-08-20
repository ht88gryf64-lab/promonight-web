import Image from 'next/image';
import Link from 'next/link';

// Founder block for the redesigned homepage: the design target's larger
// portrait treatment (290px column, tilted rounded rect) with a visible
// byline and a link to /about.
//
// NO PERSON SCHEMA. This component emits no JSON-LD. Person markup has
// exactly one emitter sitewide, /about, and it stays there; a second Person
// node describing the same human on a different URL is the thing the
// authorship work deliberately avoided.
//
// Built as a NEW component rather than an edit to IndieDeveloperBlock so the
// gate-off dark homepage (page.tsx, which renders that component's dark
// variant) stays byte-stable while the light path evolves. It also needs its
// own next/image: AvatarMatt is square-only by construction and is shared
// with /about.
//
// Prose is carried over verbatim from IndieDeveloperBlock except for the
// team and league facts, which were hardcoded there and are derived props
// here (the homepage rule that no count is written by hand).

export interface FounderBlockProps {
  /** Derived from getAllTeams().length by the caller. */
  teamCount: number;
  /** Distinct leagues among those teams, already ordered by the caller.
   *  Season-stable: teams do not leave a league in the offseason, so this
   *  sentence reads identically in August and December. */
  leagues: string[];
}

// Oxford-comma join, written out rather than taken from Intl.ListFormat so the
// output cannot vary with the runtime's ICU data.
function joinLeagues(leagues: string[]): string {
  if (leagues.length === 0) return '';
  if (leagues.length === 1) return leagues[0];
  if (leagues.length === 2) return `${leagues[0]} and ${leagues[1]}`;
  return `${leagues.slice(0, -1).join(', ')}, and ${leagues[leagues.length - 1]}`;
}

export function FounderBlock({ teamCount, leagues }: FounderBlockProps) {
  return (
    <section className="mx-auto max-w-6xl px-6">
      <div className="mb-7">
        <div className="mb-2 flex items-center gap-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.22em] text-rd-ink-faint">
          <span aria-hidden className="h-1.5 w-1.5 flex-none rounded-full bg-rd-red" />
          From the builder
        </div>
        <h2 className="rd-display text-3xl uppercase text-rd-ink md:text-4xl">
          Built by a Minnesota sports fan
        </h2>
      </div>

      <div className="grid max-w-[980px] gap-8 md:grid-cols-[290px_1fr] md:items-start md:gap-11">
        <div className="overflow-hidden rounded-[20px] border border-rd-line-strong bg-rd-cream shadow-[0_2px_6px_rgba(26,16,14,0.06),0_22px_48px_-14px_rgba(26,16,14,0.2)] md:[transform:rotate(-1.2deg)]">
          <Image
            src="/matt-avatar.jpg"
            alt="Matt Kovalik, founder of PromoNight"
            width={290}
            height={350}
            sizes="290px"
            className="block h-[280px] w-full object-cover md:h-[350px]"
          />
        </div>

        <div>
          <div className="space-y-4 font-rd text-[15.5px] leading-[1.7] text-rd-ink-soft">
            <p>
              Hi, I&apos;m Matt. I built PromoNight because I was trying to figure out which Twins
              game to take my son to this summer and realized there was no decent way to answer
              that question. Every team buries its promo schedule in a different corner of its
              website. The MLB app doesn&apos;t surface any of it. Fan forums were where people
              actually asked &ldquo;what&apos;s the giveaway tonight?&rdquo; which felt like a
              pretty clear signal that nobody had solved this.
            </p>
            <p>
              So I spent a few months building it. PromoNight started with just the Twins and now
              tracks every giveaway, theme night, food deal, and kids event across all {teamCount}{' '}
              teams in {joinLeagues(leagues)}. If you&apos;ve ever shown up to a game and found out
              you missed bobblehead night by 24 hours, this is for you.
            </p>
          </div>

          <p className="mt-6 font-mono text-[11.5px] tracking-[0.03em] text-rd-ink-faint">
            <span className="font-semibold text-rd-ink">Matt Kovalik</span> &middot; Founder,
            PromoNight &middot;{' '}
            <Link href="/about" className="font-semibold text-rd-red-dark hover:text-rd-red">
              How we track promos
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
