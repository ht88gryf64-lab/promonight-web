'use client';

import { useState } from 'react';

// The human action that completes double opt-in.
//
// A link scanner follows URLs; it does not press buttons and it does not issue
// an XHR POST off the back of a click handler. That asymmetry is the entire
// defence, which is why the write MUST stay behind this and never move back
// into a GET for convenience. See api/confirm/route.ts.
//
// No token prop: the credential is in an httpOnly cookie this component cannot
// read, so it cannot end up in a replay recording, an error report, or a log.

export function ConfirmButton() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'error'>('idle');

  const confirm = async () => {
    if (status === 'sending') return;
    setStatus('sending');
    try {
      const res = await fetch('/api/confirm', {
        method: 'POST',
        credentials: 'same-origin',
      });
      const data: { ok?: boolean; next?: string } | null = await res
        .json()
        .catch(() => null);
      if (!res.ok || !data?.ok) throw new Error();
      // Server-chosen destination rather than a hardcoded one here, so the
      // landing page can move without a client change.
      window.location.assign(data.next ?? '/preferences');
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={confirm}
        disabled={status === 'sending'}
        className="rounded-lg bg-rd-red px-5 py-3 font-rd text-[14px] font-semibold text-white transition-colors hover:bg-rd-red-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rd-red focus-visible:ring-offset-2 focus-visible:ring-offset-rd-card disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === 'sending' ? 'Confirming...' : 'Yes, confirm my subscription'}
      </button>
      {status === 'error' && (
        <p role="alert" className="mt-3 font-rd text-[13px] text-rd-red">
          That did not go through. Try again, or open the link in your email once more.
        </p>
      )}
    </div>
  );
}
