// Per-league empty placeholder used by the /promos/today filter. When a league
// filter is active and the selected league has promos on one day but not the
// other, the day without promos shows this honest "No [League] promos [today/
// tomorrow]" state instead of a blank — so filtering never yields a thin view.
// Mirrors the TodayLeagueSection header (dot + label) so the filtered view reads
// coherently. Server component.
export function LeagueDayEmpty({
  label,
  accent,
  day,
}: {
  label: string;
  accent: string;
  day: 'today' | 'tomorrow';
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: accent }}
          aria-hidden
        />
        <span className="font-rd text-[15px] font-bold uppercase tracking-[0.06em] text-rd-ink">
          {label}
        </span>
      </div>
      <div className="mt-3 rounded-2xl border border-dashed border-rd-line-strong bg-rd-card px-5 py-6 text-center">
        <p className="font-rd text-[13px] text-rd-ink-soft">
          No {label} promos {day}.
        </p>
      </div>
    </div>
  );
}
