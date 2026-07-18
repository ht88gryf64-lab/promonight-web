// Charcoal "Daily Board" hero for /promos/today. Live kicker, the H1 with the
// date in brand red, and the generated inverted-pyramid answer sentence (the text
// Google / AI Overviews pull for the "sports promotions today" intent). Pure
// server component. The date sits in its own red line rather than being joined to
// the H1 with an em dash (house no-em-dash rule).
export function DailyBoardHero({ dateLabel, answer }: { dateLabel: string; answer: string }) {
  return (
    <section className="relative overflow-hidden text-white" style={{ backgroundColor: '#1d1714' }}>
      <div
        aria-hidden
        className="absolute inset-0 z-0 opacity-60"
        style={{
          backgroundImage:
            'radial-gradient(120% 80% at 100% 0%, rgba(218,45,32,0.15) 0%, transparent 60%)',
        }}
      />
      <div className="relative z-10 mx-auto max-w-5xl px-6 pb-12 pt-14 md:pb-14 md:pt-16">
        <div className="mb-4 flex items-center gap-2 font-rd text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
          <span className="relative flex h-2 w-2" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rd-red opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-rd-red" />
          </span>
          Live · Updated daily
        </div>
        <h1 className="rd-display text-4xl uppercase leading-[0.98] text-white md:text-5xl">
          Sports Promos Today
        </h1>
        <p className="rd-display mt-1 text-2xl leading-none text-rd-red md:text-3xl">{dateLabel}</p>
        <p className="mt-4 max-w-2xl font-rd text-[15px] leading-relaxed text-white/85">{answer}</p>
      </div>
    </section>
  );
}
