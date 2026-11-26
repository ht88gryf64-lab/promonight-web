# Vercel firewall runbook (promonight-web)

Firewall rules are Vercel project state, not code. This file records what is
configured, why, when each rule is reviewed, and how to undo it. Raw configs,
payloads, traffic data and the exclusion list are private (this repo is
public). They lived in `ops/firewall/private/` (gitignored) until the firewall
worktree was removed on 2026-11-05; since then they live outside the repo, in
the operator's `~/promonight-coord/firewall-private/`. Every `private/` path
below is relative to that folder.

## Ground rules

- Never block or challenge real users. No country blocks.
- Always allow: Vercel verified bots, search engines, Google and other ad
  crawlers, AI search and assistant fetchers, SEO crawlers, link-preview
  fetchers, ad-verification crawlers (the list Raptive's partners use), and
  our own tools (`npm run test:live`, the nightly refresh, GitHub Actions
  jobs, Vercel cron). Every new rule excludes that list explicitly.
- `/ads.txt`, `/app-ads.txt` and `/robots.txt` must answer every client. No
  rule may match them.
- Any new Deny or Challenge runs as Log for at least 48h and is promoted only
  after its log shows target traffic alone.
- This plan cannot use Vercel's bot-identity rule conditions (they need a
  Priority project), so the always-allow list is matched by user agent.

## Rules

| Rule | Purpose | Action | Status |
|---|---|---|---|
| `subscribe-rate-limit` | Throttle `/api/subscribe` | Over 5/min/IP: Deny, 15 min | Live since 2026-08-29 |
| `api-rate-limit` | Throttle `/api/*`, excluding `/api/promo-card/` and `/api/share-card/` (not `/api/event-card/`; see the deferred note under "`api-rate-limit` Deny") | Over 60/min/IP: **Deny**, 5 min | Log from 2026-11-02; Deny since 2026-11-05 16:45:49Z (owner's go after the gate re-run). See "`api-rate-limit` Deny" |
| `go-rate-limit` | Throttle `/go/*`, the affiliate out-redirects (`/go/fubo`) | Over 60/min/IP (the `api-rate-limit` threshold): **Log** | Log since 2026-11-22 (config v9, rule `rule_go_rate_limit_BNB1Ve`). Deny, 5 min, after the 48h review. See "`go-rate-limit`" |
| `page-flood-guard` | Watch page-request floods | Over 300/min/IP: Log only | Live since 2026-08-31. Stays Log: our own tools trip it |
| `cloud-crawler-watch-a` | Challenge an unidentified browser crawler on one cloud-hosting network | **Challenge** | Log from 2026-11-02 15:50:57Z; Challenge since 2026-11-04 16:12:09Z (owner's go after the 48h review) |
| `cloud-crawler-watch-b` | Watch an unidentified browser on a second cloud network that may be ad verification | Log only, never Challenge | Live since 2026-11-02 15:50:57Z |
| `cloud-crawler-watch-c` | Watch an unlabeled browser crawler that arrives through the Singapore edge and requests the site-wide nav and footer pages on a cycle; most of it comes from one cloud network | **Log** only. Any future Challenge targets that network, never the country | Log since 2026-11-26 02:48:55Z (config v9 to v10). Review Mon 2026-11-30. See "`cloud-crawler-watch-c`" |
| Bot Protection (managed) | Vercel's bot scoring | Log, permanently | Challenge would hit RaptiveMegacrawler and the ad-verification crawlers, which Vercel does not identify |
| AI Bots (managed) | | Off | Stays off |

## Review dates

| When | What | Decision |
|---|---|---|
| Wed 2026-11-04 | 48h log of `cloud-crawler-watch-a` and `cloud-crawler-watch-b` | Done: `cloud-crawler-watch-a` to Challenge. `cloud-crawler-watch-b` stays Log |
| Next burst after 2026-11-04 16:12Z, or 24h | `cloud-crawler-watch-a` matches before vs after Challenge | Done 2026-11-05: every match challenged, none passed; stays Challenge |
| 2026-11-05 16:27Z | Gate re-run for the `api-rate-limit` Deny | Passed: ClaudeBot and PerplexityBot re-read robots.txt and requested no `/api/` path outside the two card routes. Deny published 16:45:49Z |
| 2026-11-06 16:45Z | `api-rate-limit` denials by bot name and path, first 24h | Expect zero from allow-listed bots and zero on the two card routes |
| 2026-11-24 or later (48h after v9) | `go-rate-limit` log: which clients pass 60/min/IP on `/go/` | Promote to Deny, 5 min, only if the matches are target traffic alone (owner's go) |
| Mon 2026-11-30 | `cloud-crawler-watch-c` log since 2026-11-26 02:48:55Z, from both sources in "`cloud-crawler-watch-c`" | Owner's call, one of: keep logging; Challenge scoped to the single cloud network, the way `cloud-crawler-watch-a` is; or remove the rule. A country-wide Challenge stays banned |

A request carries one rule id in the metrics. Traffic that Bot Protection
also logs shows as `managed_bot_filter`, so a watch rule's matches can read as
zero there; rebuild them from `vercel.request.count` with the rule's own
conditions. Pull a rule's log with
`vercel metrics vercel.firewall_action.count --filter "waf_rule_id eq '<rule id>'" --group-by client_user_agent --group-by request_path --since 48h`
or the dashboard at `/firewall/traffic?filter=<rule id>`. Rule ids are in the
latest `private/*-after.json` (`vercel firewall rules inspect <name> --json`
also prints them).

## `api-rate-limit` Deny

Live since 2026-11-05 16:45:49Z. Restores the Deny it had from 2026-08-29 to 2026-11-02, narrowed: it excludes
`/api/promo-card/` and `/api/share-card/` (CDN-cached card images), the middleware's own logging
routes (`/api/log-request`, `/api/log-crawler-hit`), the always-allow list and
the three public files. Payload: `private/proposed/item1-api-rate-limit-deny.apply.json`.
Deferred (2026-11-22): it does not exclude `/api/event-card/`, the event stop
pages' image route (robots.txt allows it), so a client outside the
always-allow list fetching event card images can be denied for 5 minutes.
Adding the exclusion is a rule change of its own.
Its gate: the robots.txt change is live and the AI crawlers that were
reading `/api/` have re-fetched robots.txt and request no `/api/` path outside
the two card routes (passed 2026-11-05). The 2026-11-04 gate failed on `/api/share-card/` (the
share card shipped 2026-11-03 while robots.txt allowed only the promo card).

## `go-rate-limit`
Added 2026-11-22 (config v8 to v9) with the Fubo hop's sub-ID parity
branch. Same threshold as `api-rate-limit` (fixed window, 60 requests per
60 s per IP) on path prefix `/go/`, excluding the same always-allow user
agent list (the regex is copied from `api-rate-limit` byte for byte). It runs
as Log, by the ground rule above: a `/go/` request is one click on an
affiliate link, so a real user never reaches 60 a minute, and robots.txt
disallows `/go/` since 2026-11-22. Payload:
`private/proposed/item5-go-rate-limit-log.apply.json`; before and after:
`private/2026-11-22-go-rate-limit-{before,after}.json` (all three in the
operator's private folder, see the note at the top). The other five rules
were byte-identical across the change, compared from those two files.

## `cloud-crawler-watch-c`

Added 2026-11-26 02:48:55Z (config v9 to v10), Log only. Since 2026-11-17 a
client with no bot label has requested the site-wide nav and footer pages
(`/`, `/download`, `/teams`, `/about`, `/my-teams`, `/promos/today`,
`/privacy`, `/terms`, `/events` and similar) through the Singapore edge,
each page hundreds of times a day and the same number of times per cycle:
about 10,600 to 32,000 unlabeled requests a day there from 2026-11-22 to
2026-11-25.
None of it reaches PostHog or Raptive. Most of it comes from one cloud
network; a smaller share comes from the network `cloud-crawler-watch-a`
already challenges.

Condition, all four must hold:

- the client's country is Singapore;
- the user agent does not contain PetalBot (Huawei's declared, verified
  crawler, which also arrives through Singapore and must never match; kept
  explicit for readability, since the always-allow list below covers it too);
- the path is not `/ads.txt`, `/app-ads.txt` or `/robots.txt`;
- the user agent does not match the always-allow list (copied from
  `api-rate-limit` byte for byte).

It is last in the rule list, so `cloud-crawler-watch-a` still challenges its
own network first. Real visitors in Singapore can match; Log has no effect on
them. That is why any future Challenge must target the cloud network, the way
`cloud-crawler-watch-a` does, never the country: a country-wide Challenge is a
country block and stays banned (ground rules above).

Review evidence comes from two sources, read together:

1. The rule's own id (`vercel metrics vercel.request.count --filter "waf_rule_id eq '<rule id>'" --group-by waf_action`,
   then by path and user agent). This shows only the Singapore traffic that
   Bot Protection does not log.
2. The Singapore traffic tagged `managed_bot_filter`, which is most of the
   target: `vercel.request.count` filtered to `client_ip_country eq 'SG'` and
   `waf_rule_id eq 'managed_bot_filter'`, grouped by user agent, network and
   path, with each row checked against the rule's four conditions from the
   private after-config.

First hour (2026-11-26 02:49Z to 03:50Z): 5 matches under the rule's own id
and 152 rebuilt from `managed_bot_filter`, all `log`, none denied or
challenged; PetalBot matched none (every PetalBot request was allowed).

At the 2026-11-30 review the owner chooses: keep logging, Challenge scoped to
the single cloud network, or remove. Payload:
`private/proposed/item6-cloud-crawler-watch-c-log.apply.json`; before and
after: `private/2026-11-25-watch-c-{before,after}.json` (named by the
operator's local date). The other six rules, Bot Protection and the rest of
the config were byte-identical across the change, compared from those two
files.

## Publishing a change

1. Save the active config:
   `vercel api "/v1/security/firewall/config/active?projectId=<id>&teamId=<id>" > private/<date>-<change>-before.json`
2. Stage it (`vercel firewall rules add|edit ... --json ... --yes`). Staging is
   not live.
3. `vercel firewall diff`. It must list only the intended change: `publish`
   ships every pending change at once. The diff does not show a rate limit's
   over-limit action changing (it prints `Rate Limit (60/60s) -> Rate Limit
   (60/60s)`); confirm that with `vercel firewall rules inspect <id> --json`.
4. `vercel firewall publish --yes`, then save the active config as
   `private/<date>-<change>-after.json` and read rule ids from it.

## Rollback

All rollbacks are staged, then published; check `vercel firewall diff` first.

- `cloud-crawler-watch-a` back to Log: `vercel firewall rules edit cloud-crawler-watch-a --action log --yes`, publish.
  Remove it entirely: `vercel firewall rules remove cloud-crawler-watch-a --yes`, publish.
- `cloud-crawler-watch-b`: `vercel firewall rules remove cloud-crawler-watch-b --yes`, publish.
- `cloud-crawler-watch-c`: `vercel firewall rules remove cloud-crawler-watch-c --yes`, publish.
  It is Log only, so removing it changes no response. A Challenge (after the
  review, owner's go) replaces the country condition with the network
  condition; it never adds Challenge to the rule as written.
- `go-rate-limit`: `vercel firewall rules remove go-rate-limit --yes`, publish.
  Promote it to Deny (after the review): `vercel firewall rules edit go-rate-limit`
  with the rate limit action `deny` and action duration `5m`; confirm with
  `vercel firewall rules inspect go-rate-limit --json`, since the diff does
  not show the action change.
- `api-rate-limit` back to Log:
  `vercel firewall rules edit api-rate-limit --json "$(jq -c .value private/proposed/item1-api-rate-limit-deny.rollback.json)" --yes`, publish.
- A Deny with an action duration keeps blocking a client for that duration
  even after the rule is removed.
- The commands use rule names; the CLI accepts a name or an id. A rule's id
  does not change when it is renamed.

## Related code

- `src/lib/robots-txt.ts`, served by `src/app/robots.txt/route.ts`: every group
  reads `Allow: /api/promo-card/`, `Allow: /api/share-card/`, `Allow: /api/event-card/`,
  `Disallow: /api/`, `Disallow: /go/`, `Allow: /`, in that order. A new image route
  under `/api/` needs its own Allow.
- `downloadLinkRel` in `src/lib/app-link.ts`: `rel="nofollow"` on every
  `/download?...` link.
- `npm run test:live` guards 4 to 7: ads files answer every client, every
  always-allow agent gets a promo page and its card images, every
  `/download?` link is nofollow, and every page image on our domain is
  allowed by robots.txt for Googlebot, Twitterbot, facebookexternalhit and `*`.
