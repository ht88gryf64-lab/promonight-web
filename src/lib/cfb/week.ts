// CFB week number for the /cfb rail.
//
// Its own module, with no Firestore import, so it can be unit-tested. A test
// importing hub-data.ts would pull in @/lib/firebase and therefore `server-only`,
// which throws outside a server component and takes the whole test file with it.
// Same reason src/lib/playoffs-headings.ts exists.

/** Whole days from `from` to `to`, both YYYY-MM-DD. Local copy of the helper in
 *  hub-data.ts: duplicating four lines is cheaper than exporting date
 *  arithmetic across a server-only boundary. */
function daysBetween(from: string, to: string): number {
  const [ay, am, ad] = from.split('-').map(Number);
  const [by, bm, bd] = to.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

// CFB week number for the hub rail. Monday-anchored, matching the Monday-to-
// Sunday window the rail itself uses (see `backToMon` above), so the label and
// the games it sits over roll on the same day.
//
// THE COUNTER WAS ALWAYS RIGHT. THE CONSTANT WAS OFF BY A WEEK.
//
// It read '2026-08-24' and called itself "Monday of Week 1". Aug 24 is the
// Monday of the week containing Saturday Aug 29, which is WEEK 0, the eight-game
// season-opening slate. Counting from there ran every label one high: on
// 2026-09-01 the rail printed "WEEK 2" over the Sep 5 and Sep 6 games, which are
// Week 1, and the site contradicted itself, because /cfb/washington rendered
// "Wk 1" for the same Apple Cup fixture. The school page was right.
//
// The 2026 season: Week 0 is Saturday Aug 29; Week 1 runs Thursday Sep 3 through
// Monday Sep 7, with Sep 5 the first full Saturday. Labor Day is Sep 7, and Week
// 1 is the week containing Labor Day weekend, so its Monday is Aug 31.
//
// WEEK 0 IS DELIBERATELY UNLABELLED. A date inside Aug 24 to Aug 30 now returns
// null, so the rail shows no week number rather than calling that slate Week 1.
// Naming it "Week 0" would be more informative and is a separate change; saying
// nothing is at least not wrong.
//
// KNOWN RESIDUAL, not fixed here. The rail slices its games Monday to Sunday
// (`backToMon` in hub-data.ts), so this counter is Monday-anchored to match it,
// and Labor Day Monday Sep 7 therefore reads WEEK 2 while college football calls
// it Week 1 (their week runs Thu Sep 3 to Mon Sep 7). There is a real Monday
// Sep 7 game in the corpus, so this is a live edge. Fixing it means moving the
// rail WINDOW to Tuesday-to-Monday, which is what the NFL hub already does and
// why Monday Night Football stays inside its own week there. That changes which
// games the rail shows, so it is a separate change from correcting the constant.
//
// This is a hardcoded season constant with no 2027 story, which the off-by-one
// is itself an argument about: the value has to be re-derived every August and
// nothing fails when it is not. Pinned by src/lib/__tests__/cfb-week.test.ts.
const CFB_2026_WEEK_1_MONDAY = '2026-08-31';

export function cfbWeekNumber(today: string): number | null {
  const diff = daysBetween(CFB_2026_WEEK_1_MONDAY, today);
  if (diff < 0) return null;
  return Math.min(15, Math.floor(diff / 7) + 1);
}