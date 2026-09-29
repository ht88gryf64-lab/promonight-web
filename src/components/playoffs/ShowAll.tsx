'use client';

import { useState, type ReactNode } from 'react';
import { CONDENSED } from './ui';

/**
 * The rest of a list, behind a button.
 *
 * The rows are in the server HTML either way; the button only decides
 * whether they are displayed. With scripts off the button cannot work, so
 * the no-script rule shows the rows and removes the button.
 */
export function ShowAll({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div id={id} className="po-more mt-2.5" data-open={open ? 'true' : 'false'}>
        {children}
      </div>
      <button
        type="button"
        data-show-all={id}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="po-more-button mt-3 w-full rounded-[10px] border border-rd-line-strong bg-rd-card px-4 py-3 text-center font-semibold uppercase tracking-[0.12em] text-rd-ink hover:border-rd-red hover:text-rd-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rd-red"
        style={{ fontFamily: CONDENSED, fontSize: 16 }}
      >
        {open ? 'Show fewer' : label}
      </button>
      <noscript>
        <style
          dangerouslySetInnerHTML={{
            __html: `#${id}.po-more{display:block!important}[data-show-all="${id}"]{display:none!important}`,
          }}
        />
      </noscript>
    </>
  );
}
