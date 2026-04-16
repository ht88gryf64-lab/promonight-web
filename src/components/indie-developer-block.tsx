import Link from 'next/link';
import { AvatarMatt } from './avatar-matt';

export function IndieDeveloperBlock() {
  return (
    <section className="py-20 px-6 border-t border-border-subtle">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <AvatarMatt size={56} />
          <div>
            <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">
              From the builder
            </span>
            <h2 className="font-display text-3xl md:text-4xl tracking-[1px] mt-1">
              BUILT BY A MINNESOTA SPORTS FAN
            </h2>
          </div>
        </div>

        <div className="space-y-4 text-text-secondary text-[15px] leading-relaxed">
          <p>
            Hi, I&apos;m Matt. I built PromoNight because I was trying to figure out which Twins game to take my son to this summer and realized there was no decent way to answer that question. Every team buries its promo schedule in a different corner of its website. The MLB app doesn&apos;t surface any of it. Fan forums were where people actually asked &ldquo;what&apos;s the giveaway tonight?&rdquo; which felt like a pretty clear signal that nobody had solved this.
          </p>
          <p>
            So I spent a few months building it. PromoNight started with just the Twins and now tracks every giveaway, theme night, food deal, and kids event across all 167 teams in MLB, NBA, NHL, NFL, MLS, and WNBA. If you&apos;ve ever shown up to a game and found out you missed bobblehead night by 24 hours, this is for you.
          </p>
        </div>

        <Link
          href="/about"
          className="inline-flex items-center gap-1 text-accent-red text-sm font-mono mt-6 hover:underline"
        >
          Read more
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
        </Link>
      </div>
    </section>
  );
}
