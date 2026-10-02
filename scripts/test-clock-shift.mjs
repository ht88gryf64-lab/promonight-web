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
// A Proxy over the real Date: `new Date()` and `Date()` read the shifted
// clock, a subclass (`class X extends Date`) keeps its own prototype through
// Reflect.construct, and everything else (prototype, statics, name, length,
// instanceof) is the real Date's.
const now = () => RealDate.now() + offset;
globalThis.Date = new Proxy(RealDate, {
  construct(target, args, newTarget) {
    return Reflect.construct(target, args.length ? args : [RealDate.now() + offset], newTarget);
  },
  apply() {
    return new RealDate(RealDate.now() + offset).toString();
  },
  get(target, prop, receiver) {
    if (prop === 'now') return now;
    return Reflect.get(target, prop, receiver);
  },
  getOwnPropertyDescriptor(target, prop) {
    const d = Reflect.getOwnPropertyDescriptor(target, prop);
    return prop === 'now' && d ? { ...d, value: now } : d;
  },
});
