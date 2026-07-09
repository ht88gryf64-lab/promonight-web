# Resolved: Ticketmaster Impact attribution vs. the env-read finding

Status: **RESOLVED 2026-07-09.** Ticketmaster attributes correctly in production.
The env read was the artifact. No code change was needed, and none was made.

Kept as a record because the false finding is easy to rediscover, and because it
documents a `vercel env pull` trap that will bite the next person who audits an
affiliate link.

## What happened

While diagnosing why Fanatics fired PostHog `affiliate_click` events but logged
no Impact clicks, a static read of the Ticketmaster configuration produced a
finding that contradicted observed production behavior.

**What the code says.** `buildTicketmasterUrl` (src/lib/affiliates.ts) wraps its
destination only when `NEXT_PUBLIC_TICKETMASTER_IMPACT_WRAP` is non-empty:

```ts
if (!TICKETMASTER_IMPACT_WRAP) {
  return directUrl;   // bare www.ticketmaster.com, no Impact redirect
}
```

**What the env read said.** `NEXT_PUBLIC_TICKETMASTER_IMPACT_WRAP` is provisioned
in Vercel Production (Encrypted). `vercel env pull --environment=production`
writes it as `NEXT_PUBLIC_TICKETMASTER_IMPACT_WRAP=""`, a raw value of length 2
(the two quote characters). Taken at face value that meant the wrap was empty at
runtime, the bare-URL branch was taken, and Ticketmaster clicks never crossed an
Impact redirect.

**What production actually renders.** The wrap is populated. A live team page
serves:

```
https://ticketmaster.evyy.net/c/7236189/264167/4272?u=https%3A%2F%2Fwww.ticketmaster.com%2Fminnesota-twins-tickets%2Fartist%2F805972&sharedid=web_team_page
```

## The trap

`vercel env pull` does not decrypt values marked Encrypted / Sensitive. It emits
an empty string rather than failing loudly. A pulled `KEY=""` therefore means
*"cannot read"*, not *"is empty"*, and the two are indistinguishable in the file.

`NEXT_PUBLIC_*` values are inlined into the client bundle at build time, so the
env store was never the authoritative source anyway.

**Rule: never conclude an affiliate link is broken from an env read. Read the
rendered href.** For this project:

```
curl -sL -A "<a real browser UA>" https://www.getpromonight.com/mlb/minnesota-twins \
  | grep -oE 'https://[a-z0-9.-]+\.net/c/7236189[^"]*'
```

Two gotchas in that command. The production host is `getpromonight.com`;
`promonight.com` is a parked domain that serves a 114-byte JS lander. And the
request needs a browser User-Agent and `-L`.

## Per-partner Impact link shapes, as rendered in production

All three run under Impact publisher account `7236189`. The SubId conventions
are **not** consistent, so do not assume one partner's shape generalizes.

| Partner | Tracking domain | adId / campaign | SubId param | SubId value |
|---|---|---|---|---|
| Ticketmaster | `ticketmaster.evyy.net` | `264167` / `4272` | `sharedid` | surface only (`web_team_page`) |
| TicketNetwork | `ticketnetwork.lusg.net` | `120057` / `2322` | `subId1` | `{surface}_{team.id}` |
| Fanatics | `fanatics.93n6tx.net` | per-team / `9663` | `subId1` | `{surface}_{team.id}` |

Ticketmaster is the odd one out on both the param name (`sharedid`) and the value
(no team id). Its wrap template lives in the env var, so changing it does not
require a deploy; the other two are hardcoded constants.

## Why Ticketmaster was left alone

Fanatics and Ticketmaster share an Impact account but not a link-construction
path. Fanatics was fixed by hardcoding its `/c/` prefix, exactly as TicketNetwork
and Expedia already do. Ticketmaster still reads its template from an env var and
works. Changing it on the strength of a static read that production evidence
contradicted would have broken live attribution.
