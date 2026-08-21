import { AppDownloadButtons } from '@/components/app-download-buttons';

// App download panel for the redesigned homepage: a dark inset card carrying
// the pitch, the store links, and one real App Store review rendered as
// ordinary visual content.
//
// NO SCHEMA. This component emits no JSON-LD of any kind, and deliberately
// carries no Review, AggregateRating, or SoftwareApplication markup, no
// itemprop, and no microdata. SoftwareApplication was removed sitewide in
// 09308df because it produced a Google rich-results error (offers with no
// rating data); the standing record of that decision is the comment in
// homepage-json-ld.tsx. The stars below are a picture of a review, not a
// rating claim about the product.
//
// Store links reuse AppDownloadButtons rather than reproducing the design
// target's two symmetric store pills, so the iOS destination (/download),
// the official Google Play badge, and all three existing analytics events
// stay exactly as they are everywhere else on the site. Section value is its
// own so the redesign's clicks stay separable from the live app section.
//
// Panel colour uses house tokens (rd-ink plus the HomeHero red wash) instead
// of the target's untokened maroon gradient, so the page's two dark panels
// agree with each other.

const PANEL_INK = '#211d18'; // --color-rd-ink, the house charcoal
const STAR_AMBER = '#ffc45e'; // target's amber; single use, deliberately not a global token

export function AppDownloadBlock() {
  return (
    <section className="mx-auto max-w-6xl px-6">
      <div
        className="relative overflow-hidden rounded-[26px] p-8 text-white md:p-[52px]"
        style={{ backgroundColor: PANEL_INK }}
      >
        <div
          aria-hidden
          className="absolute inset-0 z-0 opacity-60"
          style={{
            backgroundImage:
              'radial-gradient(115% 135% at 82% 8%, rgba(218,45,32,0.22) 0%, transparent 58%)',
          }}
        />
        <div className="relative z-10 grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-13">
          <div>
            <p className="flex items-center gap-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.22em] text-white/45">
              <span aria-hidden className="h-1.5 w-1.5 flex-none rounded-full bg-rd-red" />
              Never miss a promo night
            </p>
            <h2 className="rd-display mt-3 text-3xl uppercase leading-[0.95] text-white md:text-[42px]">
              Get promo reminders for your teams.
            </h2>
            <p className="mt-4 max-w-md font-rd text-[15px] leading-relaxed text-white/70">
              PromoNight Pro sends a reminder the morning of every promo for the teams you
              follow. The app is a free download and everything else lives here on the web.
            </p>
            <div className="mt-7 flex justify-start">
              <AppDownloadButtons section="homepage_app_block" page="home" variant="compact" />
            </div>
          </div>

          <figure className="rounded-2xl border border-white/10 bg-white/[0.06] p-7">
            <span
              role="img"
              aria-label="Five out of five stars"
              className="block text-[15px] tracking-[4px]"
              style={{ color: STAR_AMBER }}
            >
              &#9733;&#9733;&#9733;&#9733;&#9733;
            </span>
            <blockquote className="mt-3 font-rd text-[15px] leading-relaxed text-white">
              &ldquo;This app is sick. I could never keep track of all the promos for MLB games
              until now.&rdquo;
            </blockquote>
            <figcaption className="mt-4 font-mono text-[10.5px] uppercase tracking-[0.12em] text-white/50">
              DaveyMcDaveFace1 &middot; App Store review
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
