// Preload for `npm run test:future`: moves the real clock forward by
// TEST_CLOCK_SHIFT_DAYS (default 365) for the whole test run, so a test that
// reads the real date against an aged fixture fails here first, not on main
// the day the fixture ages out (known-issues 62). The clock keeps ticking;
// only its starting point moves.
//
// LIMITS. A file that pins its own clock with mock.timers never sees the
// shift, so a new real-clock read added to one of those files is not caught
// here. Intl.DateTimeFormat#format() called with no date reads the engine's
// own clock, not this one (nothing in src does that today).
const days = Number(process.env.TEST_CLOCK_SHIFT_DAYS ?? 365);
if (!Number.isFinite(days)) throw new Error(`TEST_CLOCK_SHIFT_DAYS is not a number: ${process.env.TEST_CLOCK_SHIFT_DAYS}`);
const RealDate = Date;
const offset = days * 86_400_000;
// A function, not a class, so `Date()` without `new` works as it does
// natively (it returns the current time as a string).
function ShiftedDate(...args) {
  if (!new.target) return new RealDate(RealDate.now() + offset).toString();
  return args.length === 0 ? new RealDate(RealDate.now() + offset) : new RealDate(...args);
}
ShiftedDate.prototype = RealDate.prototype;
Object.setPrototypeOf(ShiftedDate, RealDate);
ShiftedDate.now = () => RealDate.now() + offset;
globalThis.Date = ShiftedDate;
