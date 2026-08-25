import type { FAQItem } from '@/lib/promo-helpers';
import { numberWord } from '@/lib/coverage-counts';

/**
 * /about editorial copy, in one place.
 *
 * WHY A MODULE AND NOT JSX. The page renders two gate variants, and the old
 * page carried the prose twice, verbatim. Two copies of 620 words drift, and
 * the FAQ answers are also FAQPage schema, so a drift between them is a
 * machine-readable disagreement. Everything visible on /about is built here and
 * rendered by both variants from this one source, so parity is structural
 * rather than something a reviewer has to check.
 *
 * COUNTS ARE DERIVED. Nothing here hardcodes the team count, the league count,
 * the CFB school count or the ranked-team count. Those are passed in from live
 * data. The literals they replaced had already gone stale on this page (169 was
 * right, "around 2,700 promos" was not) with no alarm that would catch it.
 *
 * ACCURACY. Every factual claim in this file was checked against the repo, the
 * pipeline, the Flutter source and Firestore on 2026-08-22, and several draft
 * sentences were corrected as a result. The ones worth not re-breaking:
 *   - the 169 teams span SIX leagues; college football is a separate corpus,
 *     additional to them, and carries schedules and venues rather than promos
 *   - source URLs are on most UPCOMING promos, not most promos: the archive is
 *     thinner and the corpus-wide figure is under half
 *   - the source check is title-only, and auto-publish is the default for new
 *     dated promos and for wording changes; review is not
 *   - Pro is ONE entitlement sold at two prices, not two tiers of access
 *   - the app covers four leagues; the website covers six plus CFB
 * See docs/known-issues.md entry 37.
 */

/**
 * LAST EDITORIAL REVIEW of the copy in this file.
 *
 * This is a real date, not a render clock: it records when a human last read
 * these words and stood behind them. It is the same pattern /terms and
 * /privacy use (LegalLayout `updated=`), and it follows the house ruling at
 * src/components/json-ld.tsx:123 that a synthesized dateModified is a defect
 * while a static, deliberate anchor is a real claim.
 *
 * BUMP IT WHEN YOU CHANGE THE COPY. src/lib/__tests__/about-freshness.test.ts
 * fails the build if the copy below changes and this does not, so it cannot go
 * quietly stale. The sitemap entry for /about reads this same constant, so the
 * visible date and <lastmod> cannot disagree.
 */
export const ABOUT_LAST_REVIEWED = '2026-08-25';

/** Human rendering of ABOUT_LAST_REVIEWED. Fixed parts only, no locale clock. */
export const ABOUT_LAST_REVIEWED_LABEL = 'August 25, 2026';

// SHA-256 of this file with every line naming the fingerprint removed, so the
// value cannot hash itself. The lockstep test recomputes it; a mismatch means
// the copy moved without the review date moving. Keep the assignment on ONE
// line: a wrapped value would put the digest back into its own input.
// The test prints the correct value when it fails, so there is nothing to run
// by hand.
// eslint-disable-next-line prettier/prettier
export const ABOUT_COPY_FINGERPRINT = '58915618f6d8c224ea888eb0e4d266e86b6e3753defaa2e62571ac68a4c5e77e';

export interface AboutCounts {
  teamCount: number;
  leagueCount: number;
  /** "MLB, NBA, NFL, NHL, MLS, and WNBA" in canonical order. */
  leagueList: string;
  cfbSchoolCount: number;
  /** Teams that carry a promo score, i.e. the leagues /team-rankings covers. */
  rankedTeamCount: number;
  /** "MLB, MLS, and WNBA". */
  rankedLeagueList: string;
}

/** Inline links are written as [label](/path) and rendered by both variants
 *  through the same parser, so the copy owns its links and the two gate
 *  branches cannot link differently. */
export type AboutBlock =
  | { kind: 'p'; text: string }
  | { kind: 'points'; items: Array<{ lead: string; text: string }> };

export interface AboutSection {
  /** Stable anchor id. Nothing links to these yet; they exist so a future
   *  inbound link has something to point at. */
  id: string;
  heading: string;
  blocks: AboutBlock[];
}

// Spelled-out small numbers. Deriving a count must not silently rewrite "six
// leagues" as "6 leagues". The helper lives with the rest of the coverage
// derivation (src/lib/coverage-counts.ts) and is re-exported here.
export { numberWord };

/** The SERP and og:description text. Lives here rather than in the route so it
 *  sits under the same review-date guard as the rest of the copy. */
export function aboutMetaDescription(c: AboutCounts): string {
  return (
    `How PromoNight finds, checks and publishes promotional schedules for ${c.teamCount} teams ` +
    `across ${numberWord(c.leagueCount)} leagues, plus ${c.cfbSchoolCount} college football programs. ` +
    `Written by Matt Kovalik in Minneapolis.`
  );
}

export function aboutLede(c: AboutCounts): string {
  return (
    `PromoNight is a promotional calendar for professional and college sports. It tracks giveaways, ` +
    `theme nights, food deals and family events for ${c.teamCount} teams across ${c.leagueList}, and it ` +
    `covers schedules, venues and rivalries for ${c.cfbSchoolCount} college football programs. ` +
    `Everything lives on this website. There is also a free app, which does one thing the web cannot.`
  );
}

export function aboutSections(c: AboutCounts): AboutSection[] {
  return [
    {
      id: 'why',
      heading: 'Why this exists',
      blocks: [
        { kind: 'p', text: 'I was trying to figure out which Twins game to take my son to.' },
        {
          kind: 'p',
          text:
            'That should have been a five-minute decision. Instead I found myself on the Twins site, then a ticketing page, then a press release from February, trying to work out whether the bobblehead night was the Saturday or the Sunday, and whether the giveaway was for the first 10,000 fans or everyone. Then I did the same thing for the Wild. Then the Loons.',
        },
        {
          kind: 'p',
          text:
            'Every team publishes this information. Almost none of them publish it the same way. Some bury it in a schedule grid, some put it in a news post that rotates off the homepage in a week, some render the date inside an image so you cannot even copy it. There is no standard and no feed. Behind this site there are 66 different team and league hosts to read, and three completely different ways of reading them, which is a reasonable measure of how little agreement there is about where a promotion should live.',
        },
        {
          kind: 'p',
          text: 'So I made a list for myself. The list turned into a database. The database turned into this.',
        },
      ],
    },
    {
      id: 'website',
      heading: 'Why the website is the product',
      blocks: [
        {
          kind: 'p',
          text: 'PromoNight started as an app, and for a while the website was a page that told you to download it.',
        },
        {
          kind: 'p',
          text:
            'That was the wrong way around, and the data made it obvious. People do not want a promo calendar in their pocket at all times. They want it once, on a Tuesday, when they are deciding about Saturday. That is a browser task. You search for what your team is giving away, you get an answer, you buy tickets or you do not, and you close the tab.',
        },
        {
          kind: 'p',
          text:
            'So the website became the product. The whole calendar, no download and no account required. [Team pages](/teams), [collections by promo type](/best-promos), [venue guides](/venues) and [weekly rankings](/team-rankings), all free and all public.',
        },
        {
          kind: 'p',
          text:
            'The app is still here and still free, and it is the only place that can do the one thing a webpage genuinely cannot: reach you on the morning of the game, when you have forgotten. That morning reminder is the Pro feature. It is a real job and it is worth having. It is just not the main one.',
        },
      ],
    },
    {
      id: 'data',
      heading: 'How the data gets here',
      blocks: [
        {
          kind: 'p',
          text:
            'This is the part most people do not ask about, and it is the part that matters most, so here it is.',
        },
        {
          kind: 'points',
          items: [
            {
              lead: 'Everything comes from official team sources.',
              text:
                'Team websites, their ticketing pages, and their press releases. Nothing is copied from another aggregator, and nothing is guessed. When a promo appears here, it appeared on the team’s own site first.',
            },
            {
              lead: 'Most upcoming promos carry the exact page they came from.',
              text:
                'Not the team’s homepage, the specific URL where the promotion was published. When something looks wrong, that is the first thing I check.',
            },
            {
              lead: 'The schedules get rechecked on a cadence, where a cadence honestly exists.',
              text:
                '[MLB](/mlb) is rechecked weekly, year round. [MLS](/mls) is rechecked weekly through its season. [WNBA](/wnba) is rechecked weekly from May through September. Those three re-run on their own, though a couple of clubs publish at unpredictable addresses and need a URL added by hand.',
            },
            {
              lead: 'The other leagues work differently, and I would rather say so than imply a cadence that is not there.',
              text:
                'NBA, [NHL](/nhl) and [NFL](/nfl) publish in bursts, mostly right before their seasons start, and they get added by hand when I run a sweep. NHL is the one I am working on next, and I will be straight about where it stands: several clubs have already posted their 2026-27 promotions and they are not here yet. That is a gap I am closing, not a claim that there is nothing to find. [College football](/cfb) is different again: those pages carry schedules, venues and rivalries, not promotions.',
            },
            {
              lead: 'A new promo’s title has to be built from words that are actually on the page it came from.',
              text:
                'If a word turns up that is not in the source, the promo stops instead of publishing. Changes work the same way by category: a different giveaway type, a different opponent, or a cut to the number of items stops for review. Wording and detail changes go straight through.',
            },
            {
              lead: 'Removing a promo is harder than adding one.',
              text:
                'A promotion that vanishes from a team’s site once is not treated as cancelled. It has to be gone three separate times before it comes down, and a run that could not read the page properly does not count toward that.',
            },
          ],
        },
        {
          kind: 'p',
          text:
            'None of this makes the data perfect. Teams announce late, change dates, and quietly cancel things. What it means is that when PromoNight is wrong, it is usually wrong the same way the team’s own website was wrong, and it usually corrects itself within a week.',
        },
      ],
    },
    {
      id: 'what',
      heading: 'What is here',
      blocks: [
        {
          kind: 'points',
          items: [
            {
              lead: 'Team pages',
              text:
                `for all ${c.teamCount} teams, carrying whatever promotional calendar the team has published, past and upcoming, plus venue details for the ballpark or arena. MLB, MLS and WNBA carry a full season. NBA, NHL and most of the NFL are still waiting on team announcements. [Browse every team](/teams).`,
            },
            {
              lead: 'Collections',
              text:
                'that cut across teams: [bobblehead nights](/promos/bobbleheads), [theme nights](/promos/theme-nights), [food deals](/promos/food-deals), [jersey giveaways](/promos/jersey-giveaways), [what is on today](/promos/today) and [what is on this week](/promos/this-week).',
            },
            {
              lead: 'Venue guides',
              text:
                'covering parking, transit, gate times and bag policies for the buildings we have verified. [See the venues](/venues).',
            },
            {
              lead: 'Rankings',
              text:
                `for ${c.rankedLeagueList}, covering ${c.rankedTeamCount} teams. Each promotion is scored on what it actually is, a jersey outranks a magnet schedule, and on how limited it is. Team scores then reward variety: a club running bobbleheads, jerseys, theme nights and kids days outranks one running only bobbleheads. [See the rankings](/team-rankings).`,
            },
            {
              lead: 'College football',
              text:
                `${c.cfbSchoolCount} programs: schools, venues, and the rivalries and trophies that make certain Saturdays different. [Start here](/cfb).`,
            },
          ],
        },
      ],
    },
    {
      id: 'app',
      heading: 'What the app is for',
      blocks: [
        {
          kind: 'p',
          text:
            'The free PromoNight app covers MLB, NBA, NHL and MLS. You can follow teams, browse their promotional calendars, and unlock one venue’s Game Day details, which is yours to keep.',
        },
        {
          kind: 'p',
          text:
            'PromoNight Pro is one subscription, sold at two prices: $5.99 for a season or $9.99 for a year, both auto-renewing. It adds a reminder on the morning of a promo day for the teams you follow, and unlimited Game Day venue unlocks instead of the single free one.',
        },
        {
          kind: 'p',
          text:
            'That is the entire paid product. The website stays free, complete and unrestricted, because the website is the point.',
        },
      ],
    },
    {
      id: 'money',
      heading: 'How this is paid for',
      blocks: [
        {
          kind: 'p',
          text:
            'The site runs display advertising, and some links to tickets and merchandise are affiliate links, which means PromoNight earns a commission if you buy through one. Nobody pays to be listed here, and no affiliate relationship changes which promotions appear or how they are scored. The full disclosure is in the [terms](/terms).',
        },
      ],
    },
    {
      id: 'who',
      heading: 'Who I am',
      blocks: [
        {
          kind: 'p',
          text:
            'I am Matt Kovalik. I live in the Twin Cities and I built this in evenings and weekends because nobody else had.',
        },
        {
          kind: 'p',
          text:
            'I am a Minnesota sports fan across the board: Twins, Vikings, Wild, Wolves, Lynx, Loons and Gophers. That is relevant mostly because it means I use this thing constantly, and I notice when it is wrong.',
        },
        {
          kind: 'p',
          text:
            'PromoNight is not a company with a team. There is no team. The company is Kovalik Digital LLC, which is also just me, a lot of scripts, and an unreasonable amount of care about whether the bobblehead night is on the Saturday or the Sunday.',
        },
        {
          kind: 'p',
          text:
            'If you find something wrong, email me at [hello@getpromonight.com](mailto:hello@getpromonight.com). I read all of it and I would rather know.',
        },
      ],
    },
  ];
}

/** Rendered as the visible FAQ AND as FAQPage schema, from this one array, so
 *  the two cannot disagree. */
export function aboutFaqs(c: AboutCounts): FAQItem[] {
  return [
    {
      question: 'Is PromoNight free?',
      answer:
        'The website is completely free and always will be: the whole calendar and every venue guide, no account required. The app is a free download. PromoNight Pro is an optional subscription that adds promo-day reminders and unlimited Game Day venue unlocks.',
    },
    {
      question: 'Where does the promo data come from?',
      answer:
        'Official team sources only: team websites, their ticketing pages, and their press releases. Most upcoming promotions carry the specific URL they were extracted from, and a new promotion whose title uses words that do not appear on that page is held rather than published.',
    },
    {
      question: 'How often is it updated?',
      answer:
        'MLB is rechecked weekly year round. MLS is rechecked weekly through its season, and WNBA weekly from May through September. NBA, NHL and NFL are added by hand as teams announce, which for most of them happens in a burst before the season starts.',
    },
    {
      question: 'Which leagues are covered?',
      answer:
        `The website covers ${c.leagueList}, plus schedules, venues and rivalries for ${c.cfbSchoolCount} college football programs. The app currently covers MLB, NBA, NHL and MLS.`,
    },
    {
      question: 'Who runs PromoNight?',
      answer:
        'One person. I am Matt Kovalik, a Minnesota sports fan in the Twin Cities, and the company is Kovalik Digital LLC, which is also just me. No league, team or media group is involved.',
    },
    {
      question: 'How does PromoNight make money?',
      answer:
        'Display advertising, and affiliate commissions when someone buys tickets or merchandise through a link here. Nobody pays to be listed, and affiliate relationships do not change which promotions appear or how they are scored.',
    },
    {
      question: 'Something looks wrong. How do I report it?',
      answer:
        'Email hello@getpromonight.com with the team and the promotion. Corrections go in ahead of everything else, because a calendar that is confidently wrong is worse than one that is incomplete.',
    },
  ];
}
