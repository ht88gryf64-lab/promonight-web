import { archivoHouse } from './redesign/fonts-house';
import { isRedesignEnabled } from '@/lib/redesign';

export function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  if (isRedesignEnabled()) {
    // Light house: cream body, warm-charcoal text, Archivo. The global BrandBar/
    // Footer wrap this. Copy (children) is unchanged.
    return (
      <div className={`${archivoHouse.variable} rd-root min-h-screen pt-16 pb-20 px-5`}>
        <div className="max-w-[680px] mx-auto">
          <h1 className="rd-display text-3xl md:text-4xl uppercase text-rd-ink mb-1.5">{title}</h1>
          <p className="font-rd text-rd-ink-faint text-sm mb-10">Last updated: {updated}</p>
          <div className="legal-content font-rd text-rd-ink-soft text-[15px] leading-[1.7] [&_h2]:rd-display [&_h2]:text-rd-ink [&_h2]:text-xl [&_h2]:uppercase [&_h2]:mt-10 [&_h2]:mb-3 [&_p]:mb-4 [&_ul]:my-2.5 [&_ul]:ml-5 [&_ul]:list-disc [&_li]:mb-2 [&_strong]:text-rd-ink [&_a]:text-rd-red [&_a:hover]:underline [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-rd-line [&_hr]:my-10">
            {children}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-28 pb-20 px-5">
      <div className="max-w-[680px] mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-1.5">{title}</h1>
        <p className="text-text-muted text-sm mb-10">Last updated: {updated}</p>
        <div className="legal-content text-text-secondary text-[15px] leading-[1.7] [&_h2]:text-white [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-10 [&_h2]:mb-3 [&_p]:mb-4 [&_ul]:my-2.5 [&_ul]:ml-5 [&_ul]:list-disc [&_li]:mb-2 [&_strong]:text-[#e4e4e7] [&_a]:text-accent-red [&_a:hover]:underline [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-border-subtle [&_hr]:my-10">
          {children}
        </div>
      </div>
    </div>
  );
}
