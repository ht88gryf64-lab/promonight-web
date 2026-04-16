import Image from 'next/image';
import { existsSync } from 'fs';
import { join } from 'path';

const SHOTS = [
  {
    src: '/screenshots/home.png',
    alt: 'PromoNight home screen showing featured hot promos across MLB teams',
    caption: 'Hot promos, every league',
  },
  {
    src: '/screenshots/detail.png',
    alt: 'PromoNight promo detail screen for Roki Sasaki Bobblehead night with tickets and fan gear links',
    caption: 'Tap any promo for tickets',
  },
  {
    src: '/screenshots/gameday.png',
    alt: 'PromoNight game day view showing venue-level food and drink deals at Target Field',
    caption: 'Game-day food and drink deals',
  },
];

function Placeholder({ caption }: { caption: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#0e1017] via-[#0a0c13] to-[#060810] p-6 text-center">
      <div className="font-display text-xl tracking-wider">
        <span className="text-white">PROMO</span>
        <span className="text-accent-red">NIGHT</span>
      </div>
      <div className="mt-5 font-mono text-[10px] tracking-[1px] uppercase text-text-muted">
        {caption}
      </div>
      <div className="mt-6 text-text-dim text-[10px] font-mono leading-relaxed">
        Screenshot coming soon
      </div>
    </div>
  );
}

export function AppScreenshotStrip() {
  const publicDir = join(process.cwd(), 'public');

  const shotsWithPresence = SHOTS.map((s) => ({
    ...s,
    exists: existsSync(join(publicDir, s.src)),
  }));

  return (
    <section className="py-20 px-6 border-t border-border-subtle">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">
            The app
          </span>
          <h2 className="font-display text-4xl md:text-5xl tracking-[1px] mt-2">
            EVERY PROMO IN YOUR POCKET
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10">
          {shotsWithPresence.map((shot) => (
            <figure
              key={shot.src}
              className="flex flex-col items-center text-center"
            >
              <div
                className="relative w-full max-w-[260px] aspect-[9/19.5] rounded-[36px] p-[3px] bg-gradient-to-br from-[#2a2c38] via-[#18191f] to-[#0e1017] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]"
              >
                <div className="absolute inset-0 rounded-[36px] border border-white/5 pointer-events-none" />
                <div className="relative w-full h-full rounded-[33px] overflow-hidden bg-[#060810]">
                  {shot.exists ? (
                    <Image
                      src={shot.src}
                      alt={shot.alt}
                      fill
                      sizes="(max-width: 768px) 80vw, 260px"
                      className="object-cover"
                    />
                  ) : (
                    <Placeholder caption={shot.caption} />
                  )}
                </div>
              </div>
              <figcaption className="mt-5 font-mono text-[11px] tracking-[0.5px] uppercase text-text-muted">
                {shot.caption}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
