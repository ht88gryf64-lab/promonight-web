// One line in a league hub's hero when the hub names the NEXT season early:
// "8 of 30 clubs have published 2027 promotions so far." (getLeagueHubSeason,
// src/lib/data.ts). It rides HubHero's `notice` slot, so a hub that has not
// flipped passes nothing and renders the markup it always did.
export function HubSeasonNote({ text }: { text: string }) {
  return (
    <p data-hub-season-note className="mt-3 font-rd text-[13px] text-white/70">
      {text}
    </p>
  );
}
