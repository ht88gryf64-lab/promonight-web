// Preload for `npm run test:future`: moves the real clock forward by
// TEST_CLOCK_SHIFT_DAYS (default 365) for the whole test run, so a test that
// reads the real date against an aged fixture fails here first, not on main
// the day the fixture ages out (known-issues 62). The clock keeps ticking;
// only its starting point moves. Tests that pin their own clock with
// mock.timers are unaffected.
const days = Number(process.env.TEST_CLOCK_SHIFT_DAYS ?? 365);
if (!Number.isFinite(days)) throw new Error(`TEST_CLOCK_SHIFT_DAYS is not a number: ${process.env.TEST_CLOCK_SHIFT_DAYS}`);
const RealDate = Date;
const offset = days * 86_400_000;
class ShiftedDate extends RealDate {
  constructor(...args) {
    if (args.length === 0) super(RealDate.now() + offset);
    else super(...args);
  }
  static now() {
    return RealDate.now() + offset;
  }
}
globalThis.Date = ShiftedDate;
