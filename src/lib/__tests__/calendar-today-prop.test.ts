import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

/**
 * Known-issues entry 52. Both calendars are client components, so they render
 * on the server (once, in UTC, into an ISR copy that lives up to a day) and on
 * the visitor's device (their clock, at visit time). "Today" decides which game
 * days get a hidden, server-rendered detail panel, so a clock read in render
 * made the two sides disagree whenever a game date sat between the two todays,
 * and React threw #418 on about 10% of team pageviews. The fix is that "today"
 * arrives as a prop from the page and the visitor's clock is read only after
 * mount. These assertions are the shape of that fix, so the defect cannot come
 * back through a tidy-up.
 */
const CALENDARS = ['src/components/redesign/CalendarGrid.tsx', 'src/components/team-calendar.tsx'];
const PAGE = 'src/app/[sport]/[team]/page.tsx';

const stripComments = (src: string) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}|\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, '');

for (const file of CALENDARS) {
  describe(file, () => {
    const code = stripComments(readFileSync(file, 'utf8'));

    it('reads the clock exactly once, and only inside a useEffect', () => {
      const reads = [...code.matchAll(/new Date\(\)/g)].map((m) => m.index!);
      assert.equal(reads.length, 1, 'expected one clock read, the post-mount one');
      const effectStart = code.lastIndexOf('useEffect(() => {', reads[0]);
      assert.ok(effectStart > -1, 'the clock read is not inside a useEffect');
      const effectEnd = code.indexOf('}, []);', effectStart);
      assert.ok(effectEnd > reads[0], 'the clock read is outside the effect body');
      assert.doesNotMatch(code, /Date\.now\(\)|todayYmd\(\)/);
    });

    it('takes today as a required string prop', () => {
      assert.match(code, /\n\s*today: string;/);
      assert.match(code, /today: todayKey/, 'the prop is bound as todayKey');
    });

    it('uses the visitor clock for the ring only', () => {
      assert.match(code, /const ringKey = visitorTodayKey \?\? todayKey;/);
      assert.match(code, /const isToday = cell\.dateStr === ringKey;/);
      // nothing else may read the visitor's key
      // lowercase `visitorTodayKey` does not match inside `setVisitorTodayKey`
      assert.equal(code.split('visitorTodayKey').length - 1, 2, 'declared once, read once');
    });

    it('derives the prerender window from the prop', () => {
      assert.match(code, /today: todayKey,|Date\.UTC\(today\.year, today\.month, today\.day\)/);
    });
  });
}

describe('the page passes one today into both calendar owners', () => {
  const code = stripComments(readFileSync(PAGE, 'utf8'));
  it('computes todayStr once in the page component and forwards it', () => {
    const pageStart = code.indexOf('export default async function');
    const body = code.slice(pageStart);
    assert.equal(body.split('const todayStr = ').length - 1, 1);
    assert.equal(body.split('today={todayStr}').length - 1, 2, 'RedesignTeamPage and TeamCalendar');
  });
});

describe('SeasonExplorer forwards today untouched', () => {
  const code = stripComments(readFileSync('src/components/redesign/SeasonExplorer.tsx', 'utf8'));
  it('declares and forwards the prop', () => {
    assert.match(code, /\n\s*today: string;/);
    assert.match(code, /today=\{today\}/);
  });
});
