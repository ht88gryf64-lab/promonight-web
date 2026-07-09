# Open question: Ticketmaster Impact attribution vs. the env-read finding

Status: unresolved, no code changed. Logged 2026-07-09 while fixing Fanatics
(`feature/fanatics-impact-wrap`). Do not act on this without the rendered-href
check below.

## The conflict

While diagnosing why Fanatics fired PostHog `affiliate_click` events but logged
no Impact clicks, a static read of the Ticketmaster configuration produced a
finding that contradicts observed production behavior.

**What the code says.** `buildTicketmasterUrl` (src/lib/affiliates.ts) wraps its
destination only when `NEXT_PUBLIC_TICKETMASTER_IMPACT_WRAP` is non-empty:

```ts
if (!TICKETMASTER_IMPACT_WRAP) {
  return directUrl;   // bare www.ticketmaster.com, no Impact redirect
}
```

**What the env read says.** `NEXT_PUBLIC_TICKETMASTER_IMPACT_WRAP` is provisioned
in Vercel Production (Encrypted, created ~66 days before 2026-07-09), but
`vercel env pull --environment=production` writes it as `NEXT_PUBLIC_TICKETMASTER_IMPACT_WRAP=""`,
a raw value of length 2 (the two quote characters). Taken at face value, that
means the wrap is empty at runtime, the bare-URL branch is taken, and
Ticketmaster clicks never cross an Impact redirect.

**What production says.** Ticketmaster is attributing and converting in Impact.
This is directly observed, and it is incompatible with the bare-URL branch.

## Most likely explanation

The env read is probably wrong, not the code. Candidate causes, in rough order
of likelihood:

1. `vercel env pull` does not decrypt values marked **Encrypted** or Sensitive,
   and emits an empty string rather than failing loudly. The variable would then
   be correctly populated at build time and only *appear* empty locally.
2. The pull resolved a different environment or project than the one serving
   production traffic.
3. The value is injected at build time by something other than the Vercel env
   store (a CI step, a project-level integration).

Note that `NEXT_PUBLIC_*` values are inlined into the client bundle at build
time, so the authoritative check does not involve the env store at all.

## The check that would settle it

Do not re-read the env var. Read the rendered output instead:

1. Load a production team page (for example `/mlb/minnesota-twins`).
2. Inspect the Ticketmaster CTA's `href` in the DOM, or grep the built page
   payload for `ticketmaster`.
3. If the href points at an Impact redirect domain, the wrap is populated at
   build time and the env-read finding is an artifact of `vercel env pull`.
   If it points at `https://www.ticketmaster.com/...` directly, then
   Ticketmaster has the same defect Fanatics had, and the Impact conversions
   are arriving through some other path that needs identifying.

Equivalent non-browser check: `curl -s https://<prod-host>/mlb/minnesota-twins | grep -o 'href="[^"]*ticketmaster[^"]*"'`
(note the WAF caveat: curl against prod can be blocked, so browser inspection is
more reliable).

## Why this was left alone

Fanatics and Ticketmaster share an Impact account but not a link-construction
path. Fanatics was fixed by hardcoding the `/c/` prefix, exactly as
TicketNetwork and Expedia already do. Ticketmaster still reads its template from
an env var. Changing Ticketmaster on the same branch would have coupled a
confirmed-broken partner to a confirmed-working one, and would have risked
breaking live attribution on the strength of a static read that production
evidence contradicts.

If the rendered-href check shows Ticketmaster is in fact emitting bare URLs, the
fix is mechanical and mirrors this branch: hardcode the `/c/{account}/{adId}/{campaignId}`
prefix, drop the env var, and set `isPartnerActive('ticketmaster')` to `true`.
