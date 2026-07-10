'use client';
import { useState } from 'react';

// Contributor form (decision record §3). The fields ARE the editorial template.
// Submits to the review QUEUE via /api/cfb/contribute — a DRAFT, never published
// directly. Everything is reviewed + fact-checked by a human before a school
// graduates. Invite depth; do not apologize for thinness.
export function ContributeForm({ schoolId, schoolName }: { schoolId: string; schoolName: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [err, setErr] = useState('');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState('sending'); setErr('');
    const f = new FormData(e.currentTarget);
    const payload = {
      schoolId,
      website: f.get('website'), // honeypot (hidden)
      name: f.get('name'), contact: f.get('contact'),
      whyYouGo: f.get('whyYouGo'), traditions: f.get('traditions'),
      gameday: f.get('gameday'), venueInWords: f.get('venueInWords'), signatureGame: f.get('signatureGame'),
    };
    try {
      const r = await fetch('/api/cfb/contribute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await r.json();
      // Gate the thank-you on the transport AND the body. The server only sends
      // ok:true after a write it confirmed, so success here always means stored.
      if (r.ok && j.ok) setState('done');
      else { setState('error'); setErr(j.error === 'contact_required' ? 'Add an email or LinkedIn so we can credit you.' : j.error === 'content_required' ? 'Tell us at least one thing about gameday.' : 'Something went wrong — try again.'); }
    } catch { setState('error'); setErr('Network error — try again.'); }
  }

  if (state === 'done') {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-lg font-bold">Thank you — it’s in the queue.</h2>
        <p className="mt-2 text-white/70">A person reviews every submission (we fact-check rivalry + travel claims and confirm it’s original) before it goes live. We’ll reach out to credit you when it publishes.</p>
      </div>
    );
  }

  const field = 'w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none';
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* honeypot — visually hidden, off-tab; bots fill it, humans don't */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="absolute left-[-9999px] h-0 w-0" aria-hidden />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">Your name<span className="text-white/40"> (for the byline)</span>
          <input name="name" required maxLength={120} className={`mt-1 ${field}`} placeholder="Jordan A." />
        </label>
        <label className="block text-sm">Email or LinkedIn<span className="text-white/40"> (credit + follow-up)</span>
          <input name="contact" required maxLength={200} className={`mt-1 ${field}`} placeholder="you@email.com" />
        </label>
      </div>

      <label className="block text-sm">Why you go — the soul of a {schoolName} Saturday
        <textarea name="whyYouGo" rows={3} maxLength={4000} className={`mt-1 ${field}`} placeholder="First-person, what makes it worth the trip." />
      </label>
      <label className="block text-sm">Traditions & theme nights
        <textarea name="traditions" rows={2} maxLength={4000} className={`mt-1 ${field}`} placeholder="Whiteouts, walks, chants, the stuff a first-timer wouldn’t know." />
      </label>
      <label className="block text-sm">Gameday logistics — tailgating, parking, transit, gate timing
        <textarea name="gameday" rows={2} maxLength={4000} className={`mt-1 ${field}`} placeholder="Where to park, when lots open, how to get in." />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">The venue, in your words
          <textarea name="venueInWords" rows={2} maxLength={4000} className={`mt-1 ${field}`} placeholder="What the stadium is actually like." />
        </label>
        <label className="block text-sm">The one game to plan around
          <input name="signatureGame" maxLength={200} className={`mt-1 ${field}`} placeholder="e.g. the rivalry, homecoming…" />
        </label>
      </div>

      {state === 'error' && <p className="text-sm text-red-400">{err}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={state === 'sending'} className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60" style={{ background: 'var(--cfb-accent)', color: 'var(--cfb-accent-on)' }}>
          {state === 'sending' ? 'Sending…' : 'Submit for review'}
        </button>
        <span className="text-xs text-white/40">Reviewed by a human before it publishes — never posted automatically.</span>
      </div>
    </form>
  );
}
