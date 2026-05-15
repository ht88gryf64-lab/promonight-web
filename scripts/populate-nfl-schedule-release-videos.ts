/* eslint-disable no-console */
// One-shot populate for `scheduleReleaseVideo` on each NFL Team doc.
//
// Usage:
//   tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs \
//     scripts/populate-nfl-schedule-release-videos.ts            # dry-run
//   tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs \
//     scripts/populate-nfl-schedule-release-videos.ts --execute  # writes
//
// Data source: Phase 1 research (2026-05-15) — searched each NFL team's
// official YouTube channel for the 2026 schedule release video, confirmed
// authenticity by parsing the YouTube page's JSON-LD ownerChannelName
// against the team display name, and curled each URL for HTTP 200. 29 of
// 32 teams had a public /watch?v= upload from their official channel
// within the May 14 release window; 3 teams (Texans, Jets, Seahawks)
// posted their reveal off-YouTube or as YouTube Shorts and are skipped
// here. Leaving those teams' field unset is intentional — the
// ScheduleReleaseVideoCard gates on field presence, so no-card is the
// correct degrade for pending teams.
//
// Spot-checked at populate time: Vikings, Lions, Raiders, Rams, Falcons,
// Bills. All six curl-verified channel + title + uploadDate match the
// agent's claims exactly. The 23 untouched entries shipped through the
// same JSON-LD verification path in the research phase. Re-run the
// research for next season; no automated refresh today.
//
// Idempotency: writes use db.doc(...).set({ scheduleReleaseVideo }, { merge: true }).
// Re-running is safe; existing fields on the team doc are preserved.
//
// channel field stores the YouTube channel name verbatim (e.g. "Raiders",
// not "Las Vegas Raiders") as captured by the populate-time check. Not
// surfaced in the UI per the Phase 3 spec; retained as an audit trail.

import { db } from '../src/lib/firebase';
import type { ScheduleReleaseVideo } from '../src/lib/types';

interface Entry {
  slug: string;
  video: ScheduleReleaseVideo;
}

const ENTRIES: Entry[] = [
  { slug: 'arizona-cardinals',     video: { url: 'https://www.youtube.com/watch?v=Ee2DvzmUsDY', title: '2026 Schedule Release',                                                                publishedAt: '2026-05-14T23:47:55Z', channel: 'Arizona Cardinals' } },
  { slug: 'atlanta-falcons',       video: { url: 'https://www.youtube.com/watch?v=RRG4lVRidj0', title: 'This is Falcons Football. | 2026 Schedule Release',                                   publishedAt: '2026-05-14T23:30:09Z', channel: 'Atlanta Falcons' } },
  { slug: 'baltimore-ravens',      video: { url: 'https://www.youtube.com/watch?v=vkahtDJUSCs', title: 'Zay Flowers Crashes Wedding With Ravens Schedule Release | Baltimore Ravens',         publishedAt: '2026-05-14T23:30:38Z', channel: 'Baltimore Ravens' } },
  { slug: 'buffalo-bills',         video: { url: 'https://www.youtube.com/watch?v=QFoqNpVhqi4', title: 'Inside the Chrysalis: Josh Allen Directs Bills 2026 Schedule Release Video Feat. William Fichtner', publishedAt: '2026-05-14T23:30:16Z', channel: 'Buffalo Bills' } },
  { slug: 'carolina-panthers',     video: { url: 'https://www.youtube.com/watch?v=QG6PM1WvhCo', title: 'Carolina Panthers | Official 2026 Schedule Release Video',                            publishedAt: '2026-05-14T23:30:06Z', channel: 'Carolina Panthers' } },
  { slug: 'chicago-bears',         video: { url: 'https://www.youtube.com/watch?v=wWEdZM5UzbI', title: 'Happy little matchups | Chicago Bears 2026 Schedule Release',                         publishedAt: '2026-05-14T23:30:16Z', channel: 'Chicago Bears' } },
  { slug: 'cincinnati-bengals',    video: { url: 'https://www.youtube.com/watch?v=SkS1LaPK7sY', title: '2026 Schedule Release | Every matchup tells a story.',                                publishedAt: '2026-05-14T23:30:25Z', channel: 'Cincinnati Bengals' } },
  { slug: 'cleveland-browns',      video: { url: 'https://www.youtube.com/watch?v=f2fNBBfVRwk', title: 'Browns 2026 Schedule Release: Street Fighter CLE',                                    publishedAt: '2026-05-14T23:30:02Z', channel: 'Cleveland Browns' } },
  { slug: 'dallas-cowboys',        video: { url: 'https://www.youtube.com/watch?v=u32agQxurec', title: 'Tyler Takeover | Dallas Cowboys Schedule Release | 2026',                             publishedAt: '2026-05-14T23:30:07Z', channel: 'Dallas Cowboys' } },
  { slug: 'denver-broncos',        video: { url: 'https://www.youtube.com/watch?v=dqfA1L7m0D0', title: "Channel surfing: Peyton Manning helps reveal the Broncos' 2026 schedule",             publishedAt: '2026-05-14T23:30:26Z', channel: 'Denver Broncos' } },
  { slug: 'detroit-lions',         video: { url: 'https://www.youtube.com/watch?v=WVo1ajLljoY', title: 'Detroit Lions 2026 Schedule Release Show',                                            publishedAt: '2026-05-14T23:33:06Z', channel: 'Detroit Lions' } },
  { slug: 'green-bay-packers',     video: { url: 'https://www.youtube.com/watch?v=cwSxCjLLsY0', title: 'Green Bay Packers 2026 Schedule Release Video',                                       publishedAt: '2026-05-14T23:30:06Z', channel: 'Green Bay Packers' } },
  { slug: 'indianapolis-colts',    video: { url: 'https://www.youtube.com/watch?v=u7wn7eXjRAI', title: '2026 Indianapolis Colts Schedule Release with the Simpsons',                          publishedAt: '2026-05-14T23:31:59Z', channel: 'Indianapolis Colts' } },
  { slug: 'jacksonville-jaguars',  video: { url: 'https://www.youtube.com/watch?v=MbjrNYeZM6E', title: 'Jaguars 2026 Schedule Release | Jacksonville Jaguars',                                publishedAt: '2026-05-14T23:30:06Z', channel: 'Jacksonville Jaguars' } },
  { slug: 'kansas-city-chiefs',    video: { url: 'https://www.youtube.com/watch?v=T7x68r4E9VA', title: 'QVChiefs Kansas City Chiefs 2026 NFL Schedule Release',                               publishedAt: '2026-05-14T23:30:40Z', channel: 'Kansas City Chiefs' } },
  { slug: 'las-vegas-raiders',     video: { url: 'https://www.youtube.com/watch?v=Tw2w4koO-kY', title: 'Did We Just Become Best Friends?! | Raiders 2026 Schedule Release',                   publishedAt: '2026-05-14T23:30:22Z', channel: 'Raiders' } },
  { slug: 'los-angeles-chargers',  video: { url: 'https://www.youtube.com/watch?v=vjP6J-vpbmo', title: 'LA Chargers Halo Schedule Release 2026',                                              publishedAt: '2026-05-14T23:31:07Z', channel: 'Los Angeles Chargers' } },
  { slug: 'los-angeles-rams',      video: { url: 'https://www.youtube.com/watch?v=0wmInmxZWjs', title: 'A Dynamite Schedule',                                                                 publishedAt: '2026-05-14T23:30:02Z', channel: 'Los Angeles Rams' } },
  { slug: 'miami-dolphins',        video: { url: 'https://www.youtube.com/watch?v=d66N89STznM', title: 'Mr. Ross wants to see you | Miami Dolphins 2026-27 Schedule Release',                 publishedAt: '2026-05-14T23:31:35Z', channel: 'Miami Dolphins' } },
  { slug: 'minnesota-vikings',     video: { url: 'https://www.youtube.com/watch?v=15l0ZFqC3pY', title: 'Minnesota Vikings 2026 Schedule Release',                                             publishedAt: '2026-05-14T23:30:33Z', channel: 'Minnesota Vikings' } },
  { slug: 'new-england-patriots',  video: { url: 'https://www.youtube.com/watch?v=7DScN_3RhEA', title: '2026 New England Patriots Schedule Release at Six Flags New England',                publishedAt: '2026-05-14T23:30:02Z', channel: 'New England Patriots' } },
  { slug: 'new-orleans-saints',    video: { url: 'https://www.youtube.com/watch?v=JfsyyTAGpNM', title: 'Saints 2026 Schedule Release Video | Official Reveal',                                publishedAt: '2026-05-14T23:30:51Z', channel: 'New Orleans Saints' } },
  { slug: 'new-york-giants',       video: { url: 'https://www.youtube.com/watch?v=mOMEypueDGI', title: 'Giants 2026 Schedule: Jameis "Winston van Gogh" Plays Pictionary',                    publishedAt: '2026-05-14T23:30:12Z', channel: 'New York Giants' } },
  { slug: 'philadelphia-eagles',   video: { url: 'https://www.youtube.com/watch?v=H0BB-6EJYnw', title: 'Eagles React to the 2026 Schedule Release',                                           publishedAt: '2026-05-14T23:30:01Z', channel: 'Philadelphia Eagles' } },
  { slug: 'pittsburgh-steelers',   video: { url: 'https://www.youtube.com/watch?v=Ov4pdyqVeCI', title: 'THE 2026 SCHEDULE IS AHT | Schedule Release Video | Pittsburgh Steelers',             publishedAt: '2026-05-14T23:30:16Z', channel: 'Pittsburgh Steelers' } },
  { slug: 'san-francisco-49ers',   video: { url: 'https://www.youtube.com/watch?v=ukF7NcGz7-k', title: 'Home of the Faithful: 2026 49ers Schedule Reveal',                                    publishedAt: '2026-05-14T23:30:13Z', channel: 'San Francisco 49ers' } },
  { slug: 'tampa-bay-buccaneers',  video: { url: 'https://www.youtube.com/watch?v=_ouyGzOGLn4', title: 'Tampa Bay Watch: 2026 Schedule Release | Tampa Bay Buccaneers',                       publishedAt: '2026-05-14T23:30:26Z', channel: 'Tampa Bay Buccaneers' } },
  { slug: 'tennessee-titans',      video: { url: 'https://www.youtube.com/watch?v=TGFd1bj-GpY', title: "Titans 2026 Schedule Release: You Never Know Who You'll See",                         publishedAt: '2026-05-14T23:31:53Z', channel: 'Tennessee Titans' } },
  { slug: 'washington-commanders', video: { url: 'https://www.youtube.com/watch?v=084Z5yNCVqw', title: 'SCHEDULE RELEASE! Commanders School Science Fair With Bill (Croskey-Merritt) the Science Guy', publishedAt: '2026-05-14T23:30:10Z', channel: 'Washington Commanders' } },
];

// Pending NFL teams from Phase 1. Reasons logged in the commit body; left
// unset on the team doc so the card silently does not render. Re-check
// each official YouTube channel in 7-10 days for a delayed cut.
const PENDING = ['houston-texans', 'new-york-jets', 'seattle-seahawks'];

async function main() {
  const execute = process.argv.includes('--execute');
  console.log(`[populate-nfl-schedule-release-videos] mode: ${execute ? 'EXECUTE' : 'DRY-RUN'}`);
  console.log(`[populate-nfl-schedule-release-videos] entries: ${ENTRIES.length}  pending: ${PENDING.length}`);
  console.log('');

  // Pre-flight: every slug must resolve to an existing team doc.
  for (const { slug } of ENTRIES) {
    const exists = (await db.collection('teams').doc(slug).get()).exists;
    if (!exists) {
      throw new Error(`team doc "${slug}" not found in Firestore. Aborting before any writes.`);
    }
  }

  for (const { slug, video } of ENTRIES) {
    console.log(`--- ${slug} ---`);
    console.log(`  url:          ${video.url}`);
    console.log(`  title:        ${video.title}`);
    console.log(`  publishedAt:  ${video.publishedAt}`);
    console.log(`  channel:      ${video.channel}`);
    if (execute) {
      await db.collection('teams').doc(slug).set({ scheduleReleaseVideo: video }, { merge: true });
      console.log(`  wrote teams/${slug}.scheduleReleaseVideo`);
    }
    console.log('');
  }

  console.log(`Pending (not written): ${PENDING.join(', ')}`);
  console.log('');
  if (!execute) {
    console.log(`[populate-nfl-schedule-release-videos] DRY-RUN complete. ${ENTRIES.length} writes would land. Re-run with --execute to write.`);
  } else {
    console.log(`[populate-nfl-schedule-release-videos] Wrote ${ENTRIES.length} team docs.`);
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
