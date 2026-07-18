// CFB's variant of the persistent hub today-slot. College football has no daily
// "promo" concept — its promotions ARE the rivalry and theme Saturdays surfaced
// in the rail right below — so an apologetic "no CFB promos today" would be
// misleading, not honest. This slot instead frames that as a feature and bridges
// to the pro leagues' daily promo board (/promos/today). Dark-themed to match the
// CFB hub. No em dashes (house rule).
const GOLD = '#FFB71E';
const SANS = 'var(--font-outfit), system-ui, sans-serif';

export function CfbTodaySlot() {
  return (
    <section
      aria-label="Today's promos"
      className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-[13px] leading-relaxed text-white/70" style={{ fontFamily: SANS }}>
          <span className="font-semibold text-white">
            College football&rsquo;s promotions are its rivalry and theme Saturdays.
          </span>{' '}
          This week&rsquo;s games are below. The pro leagues run a promo board that refreshes every day.
        </p>
        <a
          href="/promos/today"
          className="inline-flex shrink-0 items-center gap-1 text-[13px] font-bold"
          style={{ fontFamily: SANS, color: GOLD }}
        >
          Today&rsquo;s pro promos →
        </a>
      </div>
    </section>
  );
}
