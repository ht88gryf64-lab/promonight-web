# Vercel firewall runbook (promonight-web)

Firewall rules are Vercel project state, not code. This file records what is
configured, why, when each rule is reviewed, and how to undo it. Raw configs,
payloads, traffic data and the exclusion list live in `ops/firewall/private/`
(gitignored; this repo is public).

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
| `api-rate-limit` | Throttle `/api/*` | Over 60/min/IP: **Log** (Deny pending, see below) | Live; Log since 2026-11-02 |
| `page-flood-guard` | Watch page-request floods | Over 300/min/IP: Log only | Live since 2026-08-31. Stays Log: our own tools trip it |
| `cloud-crawler-watch-a` | Watch an unidentified browser crawler on one cloud-hosting network | Log | Live since 2026-11-02 15:50:57Z |
| `cloud-crawler-watch-b` | Watch an unidentified browser on a second cloud network that may be ad verification | Log only, never Challenge | Live since 2026-11-02 15:50:57Z |
| Bot Protection (managed) | Vercel's bot scoring | Log, permanently | Challenge would hit RaptiveMegacrawler and the ad-verification crawlers, which Vercel does not identify |
| AI Bots (managed) | | Off | Stays off |

## Review dates

| When | What | Decision |
|---|---|---|
| Wed 2026-11-04, 10:00 AM CT | 48h log of `cloud-crawler-watch-a` and `cloud-crawler-watch-b` | Owner decides whether `cloud-crawler-watch-a` moves to Challenge. `cloud-crawler-watch-b` stays Log |
| 24h after the chore/bot-firewall production deploy, on the owner's go | Publish the `api-rate-limit` Deny | See "Pending change" |

Pull a rule's log with
`vercel metrics vercel.firewall_action.count --filter "waf_rule_id eq '<rule id>'" --group-by client_user_agent --group-by request_path --since 48h`
or the dashboard at `/firewall/traffic?filter=<rule id>`. Rule ids are in the
latest `private/*-after.json` (`vercel firewall rules inspect <name> --json`
also prints them).

## Pending change: `api-rate-limit` to Deny

Restores the Deny it had from 2026-08-29 to 2026-11-02, narrowed: it excludes
`/api/promo-card/` (CDN-cached card images), the middleware's own logging
routes (`/api/log-request`, `/api/log-crawler-hit`), the always-allow list and
the three public files. Payload: `private/proposed/item1-api-rate-limit-deny.apply.json`.
Precondition: the robots.txt change is live and the AI crawlers that were
reading `/api/` have re-fetched robots.txt.

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

- `cloud-crawler-watch-a`: `vercel firewall rules remove cloud-crawler-watch-a --yes`, publish.
- `cloud-crawler-watch-b`: `vercel firewall rules remove cloud-crawler-watch-b --yes`, publish.
- `api-rate-limit` back to Log:
  `vercel firewall rules edit api-rate-limit --json "$(jq -c .value private/proposed/item1-api-rate-limit-deny.rollback.json)" --yes`, publish.
- A Deny with an action duration keeps blocking a client for that duration
  even after the rule is removed.
- The commands use rule names; the CLI accepts a name or an id. A rule's id
  does not change when it is renamed.

## Related code

- `src/lib/robots-txt.ts`, served by `src/app/robots.txt/route.ts`: every group
  reads `Allow: /api/promo-card/`, `Disallow: /api/`, `Allow: /`, in that order.
- `downloadLinkRel` in `src/lib/app-link.ts`: `rel="nofollow"` on every
  `/download?...` link.
- `npm run test:live` guards 4 to 6: ads files answer every client, every
  always-allow agent gets a promo page and its card image, and every
  `/download?` link is nofollow.
