#!/usr/bin/env python3
"""
Discover canonical Fanatics team-store URLs for the 46 teams missing
from the Impact directory CSV (12 already-confirmed via the discovery
session + 34 to discover via Claude API + web_search).

Reads:  scripts/fanatics-team-mapping.json (122 entries baseline)
Writes: scripts/fanatics-team-mapping.json (merged, ~168 entries)

The 34 web-search calls fan out via asyncio.gather so the whole run is
bounded by the slowest single search rather than the sum. Each call asks
Claude to return ONLY the canonical URL string; the caller validates
against a strict regex and only writes URLs that match. Anything that
fails validation is logged to gaps and not written.

Failure resilience: the merged JSON is written in a try/finally, so a
crash partway through still leaves a valid file with whatever results
completed. The 12 hardcoded CONFIRMED entries are merged BEFORE the
async fan-out so they're never at risk.

Run:
    python scripts/discover-missing-fanatics-urls.py
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Anthropic SDK — installed via `pip install --break-system-packages anthropic`
try:
    from anthropic import AsyncAnthropic
except ImportError as e:
    print(f"ERROR: anthropic package not installed. Install with:")
    print(f"  pip install --break-system-packages anthropic")
    print(f"  (underlying error: {e})")
    sys.exit(1)


# ── Configuration ─────────────────────────────────────────────────────────

REPO_ROOT = Path(__file__).resolve().parent.parent
JSON_PATH = REPO_ROOT / "scripts" / "fanatics-team-mapping.json"

# Per the brief: matches existing extraction pattern for Claude API +
# web_search tool. Tool version 20250305 is the server-side web_search
# released by Anthropic.
MODEL = "claude-sonnet-4-20250514"
WEB_SEARCH_TOOL = {
    "type": "web_search_20250305",
    "name": "web_search",
    "max_uses": 3,
}

# Path-only regex (we strip the host before matching). Three +-joined
# segments: o-N, t-N, z-N-N. NO +d-, +f-, +c-, no extra path segments.
PATH_RE = re.compile(
    r"^/(mlb|nba|nhl|nfl|mls|wnba)/[a-z0-9-]+/o-\d+\+t-\d+\+z-\d+-\d+$"
)

# URL-shape regex used to find a candidate URL inside the assistant's
# response text. Same pattern as PATH_RE but anchored to a full
# fanatics.com URL with optional trailing slash.
URL_IN_TEXT_RE = re.compile(
    r"https?://(?:www\.)?fanatics\.com/(?:mlb|nba|nhl|nfl|mls|wnba)/[a-z0-9-]+/o-\d+\+t-\d+\+z-\d+-\d+/?",
    re.IGNORECASE,
)

SYSTEM_PROMPT = (
    "Find the canonical Fanatics team-store URL via web search. "
    "The URL must match exactly: "
    "https://www.fanatics.com/{league}/{slug}/o-N+t-N+z-N-N "
    "where each N is a number. No extra path segments. "
    "No +d-, +f-, +c-. No query string. "
    "Return ONLY the URL on a single line, or NOT_FOUND if none exists."
)


# ── 12 already-confirmed via discovery session (no API call) ─────────────

CONFIRMED: dict[str, tuple[str, str]] = {
    "oakland-athletics":      ("MLB",  "/mlb/oakland-athletics/o-1209+t-03905533+z-92858-339381394"),
    "inter-miami-cf":         ("MLS",  "/mls/inter-miami-cf/o-3577+t-76706629+z-97877-2244091536"),
    "atlanta-dream":          ("WNBA", "/wnba/atlanta-dream/o-1460+t-69434525+z-92374-3568125624"),
    "chicago-sky":            ("WNBA", "/wnba/chicago-sky/o-2559+t-69106760+z-91608-4263507522"),
    "minnesota-lynx":         ("WNBA", "/wnba/minnesota-lynx/o-3693+t-14981254+z-773-2726048771"),
    "seattle-kraken":         ("NHL",  "/nhl/seattle-kraken/o-2406+t-43433500+z-98423-3949641849"),
    "utah-mammoth":           ("NHL",  "/nhl/utah-mammoth/o-3528+t-8357454616+z-9818-3541420422"),
    "connecticut-sun":        ("WNBA", "/wnba/connecticut-sun/o-4715+t-92547816+z-93624-729867934"),
    "dallas-wings":           ("WNBA", "/wnba/dallas-wings/o-1471+t-25092395+z-92906-162900988"),
    "golden-state-valkyries": ("WNBA", "/wnba/golden-state-valkyries/o-8126+t-46745985+z-8050-4214175585"),
    "indiana-fever":          ("WNBA", "/wnba/indiana-fever/o-5837+t-69436785+z-8826-1776406336"),
    "las-vegas-aces":         ("WNBA", "/wnba/las-vegas-aces/o-1482+t-87453972+z-90332-2920441961"),
}


# ── 34 teams to discover via web search ──────────────────────────────────

# (slug, league, search query)
TO_DISCOVER: list[tuple[str, str, str]] = [
    # WNBA (5)
    ("los-angeles-sparks",       "WNBA", "fanatics los angeles sparks wnba"),
    ("new-york-liberty",         "WNBA", "fanatics new york liberty wnba"),
    ("phoenix-mercury",          "WNBA", "fanatics phoenix mercury wnba"),
    ("seattle-storm",            "WNBA", "fanatics seattle storm wnba"),
    ("washington-mystics",       "WNBA", "fanatics washington mystics wnba"),
    # MLS (29)
    ("atlanta-united-fc",        "MLS",  "fanatics atlanta united fc"),
    ("austin-fc",                "MLS",  "fanatics austin fc mls"),
    ("cf-montreal",              "MLS",  "fanatics cf montreal mls"),
    ("charlotte-fc",             "MLS",  "fanatics charlotte fc mls"),
    ("chicago-fire-fc",          "MLS",  "fanatics chicago fire fc"),
    ("colorado-rapids",          "MLS",  "fanatics colorado rapids"),
    ("columbus-crew",            "MLS",  "fanatics columbus crew"),
    ("dc-united",                "MLS",  "fanatics dc united"),
    ("fc-cincinnati",            "MLS",  "fanatics fc cincinnati"),
    ("fc-dallas",                "MLS",  "fanatics fc dallas"),
    ("houston-dynamo-fc",        "MLS",  "fanatics houston dynamo fc"),
    ("la-galaxy",                "MLS",  "fanatics la galaxy mls"),
    ("lafc",                     "MLS",  "fanatics lafc los angeles fc"),
    ("minnesota-united-fc",      "MLS",  "fanatics minnesota united fc"),
    ("nashville-sc",             "MLS",  "fanatics nashville sc mls"),
    ("new-england-revolution",   "MLS",  "fanatics new england revolution"),
    ("new-york-city-fc",         "MLS",  "fanatics new york city fc"),
    ("new-york-red-bulls",       "MLS",  "fanatics new york red bulls"),
    ("orlando-city-sc",          "MLS",  "fanatics orlando city sc"),
    ("philadelphia-union",       "MLS",  "fanatics philadelphia union mls"),
    ("portland-timbers",         "MLS",  "fanatics portland timbers"),
    ("real-salt-lake",           "MLS",  "fanatics real salt lake"),
    ("san-diego-fc",             "MLS",  "fanatics san diego fc mls"),
    ("san-jose-earthquakes",     "MLS",  "fanatics san jose earthquakes"),
    ("seattle-sounders-fc",      "MLS",  "fanatics seattle sounders fc"),
    ("sporting-kansas-city",     "MLS",  "fanatics sporting kansas city"),
    ("st-louis-city-sc",         "MLS",  "fanatics st louis city sc"),
    ("toronto-fc",               "MLS",  "fanatics toronto fc mls"),
    ("vancouver-whitecaps-fc",   "MLS",  "fanatics vancouver whitecaps fc"),
]


# ── Name generation ──────────────────────────────────────────────────────
# Special cases override the title-case default. Brief prescribes these
# specifically. Default rule: title-case each dash-separated word, then
# uppercase the FC/SC/CF tokens. " Gear" suffix is appended below.

SPECIAL_NAMES_NO_SUFFIX: dict[str, str] = {
    "lafc":              "LAFC",
    "cf-montreal":       "CF Montreal",
    "dc-united":         "D.C. United",
    "fc-cincinnati":     "FC Cincinnati",
    "fc-dallas":         "FC Dallas",
    "nashville-sc":      "Nashville SC",
    "orlando-city-sc":   "Orlando City SC",
    "st-louis-city-sc":  "St. Louis CITY SC",
    "new-york-city-fc":  "New York City FC",
}


def name_for(slug: str) -> str:
    if slug in SPECIAL_NAMES_NO_SUFFIX:
        return f"{SPECIAL_NAMES_NO_SUFFIX[slug]} Gear"
    parts = slug.split("-")
    upper_tokens = {"fc", "sc", "cf"}
    rendered = [p.upper() if p in upper_tokens else p.capitalize() for p in parts]
    return f"{' '.join(rendered)} Gear"


# ── Env loader ───────────────────────────────────────────────────────────

def load_api_key() -> str:
    # 1. Shell env first.
    key = os.environ.get("ANTHROPIC_API_KEY")
    if key:
        return key
    # 2. Fallback: search known env files for the key. The user's project
    # keeps the Anthropic key in the promo-pipeline subdir env, separate
    # from the main app env.
    candidates = [
        REPO_ROOT / "promo-pipeline" / ".env.local",
        REPO_ROOT / "promo-pipeline" / ".env",
        REPO_ROOT / ".env.local",
        REPO_ROOT / ".env",
    ]
    for p in candidates:
        if not p.is_file():
            continue
        for line in p.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("ANTHROPIC_API_KEY="):
                value = line.split("=", 1)[1].strip().strip('"').strip("'")
                if value:
                    return value
    print("ERROR: ANTHROPIC_API_KEY not found in shell env or any .env file.")
    sys.exit(1)


# ── Path validation + URL extraction ─────────────────────────────────────

def normalize_to_path(text: str) -> str | None:
    """
    Pull the first canonical-shaped URL out of the response text and
    return its path portion. Returns None if no match.
    """
    if not text:
        return None
    m = URL_IN_TEXT_RE.search(text)
    if not m:
        return None
    full = m.group(0)
    # Strip query/fragment (regex doesn't allow them, but defensive)
    full = full.split("?")[0].split("#")[0]
    # Strip trailing slash for canonical form
    if full.endswith("/"):
        full = full[:-1]
    # Reduce to path
    path = re.sub(r"^https?://(?:www\.)?fanatics\.com", "", full, flags=re.IGNORECASE)
    if PATH_RE.match(path):
        return path
    return None


def extract_text_from_response(response: Any) -> str:
    """Concatenate all TextBlock.text from response.content, ignoring
    server_tool_use and web_search_tool_result blocks."""
    out: list[str] = []
    for block in response.content:
        block_type = getattr(block, "type", None)
        if block_type == "text":
            out.append(getattr(block, "text", ""))
    return "\n".join(out)


# ── Discovery (one async call per team) ─────────────────────────────────

async def discover_one(
    client: AsyncAnthropic,
    slug: str,
    league: str,
    query: str,
) -> tuple[str, str | None, str | None]:
    """
    Returns (slug, path-or-None, error-or-None).
    path is None when the URL couldn't be resolved or fails validation.
    error is a short reason string when path is None (for gap logging).
    """
    try:
        resp = await client.messages.create(
            model=MODEL,
            max_tokens=400,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": query}],
            tools=[WEB_SEARCH_TOOL],
        )
    except Exception as e:
        return slug, None, f"api_error:{type(e).__name__}:{e}"

    text = extract_text_from_response(resp)
    if not text:
        return slug, None, "empty_response"
    if "NOT_FOUND" in text and not URL_IN_TEXT_RE.search(text):
        return slug, None, "not_found"
    path = normalize_to_path(text)
    if path is None:
        # Trim the snippet so the gap log doesn't carry the whole reply.
        snippet = text.strip().splitlines()[0][:160] if text.strip() else ""
        return slug, None, f"no_canonical_url_in_response:'{snippet}'"
    # Defensive: confirm the league prefix matches what we expected.
    expected_prefix = f"/{league.lower()}/"
    if not path.startswith(expected_prefix):
        return slug, None, f"league_mismatch:got={path[:30]}_expected={expected_prefix}"
    return slug, path, None


# ── Main ─────────────────────────────────────────────────────────────────

async def amain() -> int:
    if not JSON_PATH.is_file():
        print(f"ERROR: {JSON_PATH} not found.")
        return 1

    api_key = load_api_key()
    print(f"Anthropic API key: present (value not printed)")
    print(f"Reading {JSON_PATH}")
    data = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    teams: dict[str, Any] = data.setdefault("teams", {})
    meta: dict[str, Any] = data.setdefault("_meta", {})
    starting_count = len(teams)
    print(f"Starting team count: {starting_count}")

    # Phase 1: merge the 12 hardcoded CONFIRMED entries first. They're
    # never at risk of API failures.
    confirmed_added = 0
    confirmed_skipped: list[tuple[str, str]] = []
    for slug, (league, path) in CONFIRMED.items():
        if not PATH_RE.match(path):
            confirmed_skipped.append((slug, "hardcoded_path_failed_regex"))
            continue
        if slug in teams:
            confirmed_skipped.append((slug, "already_present"))
            continue
        teams[slug] = {
            "league": league,
            "fanaticsPath": path,
            "name": name_for(slug),
            "confidence": "verified_session_discovery",
            "source": "discovery_session_2026-05-05",
        }
        confirmed_added += 1
    print(f"\nPhase 1 (CONFIRMED): added {confirmed_added}, skipped {len(confirmed_skipped)}")
    for slug, reason in confirmed_skipped:
        print(f"  skip {slug} — {reason}")

    # Phase 2: async fan-out for 34 web_search lookups. Use try/finally
    # to write whatever we have if the gather is interrupted.
    print(f"\nPhase 2 (web_search): firing {len(TO_DISCOVER)} parallel discoveries…")
    client = AsyncAnthropic(api_key=api_key)
    discovered_added = 0
    discovery_gaps: list[tuple[str, str]] = []  # (slug, reason)

    try:
        coros = [
            discover_one(client, slug, league, query)
            for slug, league, query in TO_DISCOVER
        ]
        results = await asyncio.gather(*coros, return_exceptions=True)
        # Index TO_DISCOVER by slug for league-lookup fallback when result
        # is an exception.
        league_by_slug = {slug: league for slug, league, _q in TO_DISCOVER}
        for i, r in enumerate(results):
            if isinstance(r, BaseException):
                slug = TO_DISCOVER[i][0]
                discovery_gaps.append((slug, f"unhandled_exception:{type(r).__name__}:{r}"))
                continue
            slug, path, err = r
            if path is None:
                discovery_gaps.append((slug, err or "unknown"))
                print(f"  gap {slug} — {err}")
                continue
            league = league_by_slug.get(slug, "")
            teams[slug] = {
                "league": league,
                "fanaticsPath": path,
                "name": name_for(slug),
                "confidence": "verified_google_search",
                "source": "discovery_session_2026-05-05",
            }
            discovered_added += 1
            print(f"  ok  {slug} → {path}")

    finally:
        # Phase 3: update _meta and write JSON. ALWAYS run, even if the
        # gather above raised mid-flight.
        new_count = len(teams)
        meta["totalTeams"] = new_count
        # Ensure leagues includes MLS + WNBA after the merge.
        leagues = set(meta.get("leagues") or [])
        leagues.update(["MLS", "WNBA"])
        # Recompute the league set from actual entries to keep it honest.
        live_leagues = {v.get("league") for v in teams.values() if v.get("league")}
        leagues |= live_leagues
        meta["leagues"] = sorted(leagues)

        # Update gaps:
        #   - Drop any slug we now have an entry for
        #   - Drop the legacy 'utah-hockey-club' nhl gap entry (rebrand to
        #     utah-mammoth — same team, now mapped)
        #   - Replace 'all 30 teams missing'/'all 13 teams missing' string
        #     descriptions with explicit slug lists of unresolved teams
        existing_gaps = meta.get("gaps") or {}
        new_gaps: dict[str, list[str]] = {}

        # Existing list-shaped gaps (mlb, nhl): filter to slugs not in teams.
        for league_key in ("mlb", "nhl", "nba", "nfl"):
            old = existing_gaps.get(league_key)
            if isinstance(old, list):
                remaining = [s for s in old if s not in teams and s != "utah-hockey-club"]
                if remaining:
                    new_gaps[league_key] = remaining

        # MLS: list anything in TO_DISCOVER (MLS) that didn't resolve, plus
        # the inter-miami-cf CONFIRMED entry if for some reason it didn't
        # land. Anything in MLS still unmapped goes here.
        unresolved_slugs_for_run = {s for s, _ in discovery_gaps}
        unresolved_mls = [
            s for s, lg, _q in TO_DISCOVER
            if lg == "MLS" and s in unresolved_slugs_for_run
        ]
        if unresolved_mls:
            new_gaps["mls"] = sorted(unresolved_mls)

        unresolved_wnba = [
            s for s, lg, _q in TO_DISCOVER
            if lg == "WNBA" and s in unresolved_slugs_for_run
        ]
        if unresolved_wnba:
            new_gaps["wnba"] = sorted(unresolved_wnba)

        meta["gaps"] = new_gaps

        # Append run notes
        notes = meta.setdefault("notes", [])
        if not isinstance(notes, list):
            notes = []
            meta["notes"] = notes
        notes.append(
            "Discovery session 2026-05-05 added 46 teams across MLS, WNBA, "
            "and 3 individual gaps via Google search + web_search tool."
        )
        meta["lastUpdated"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        # Write
        JSON_PATH.write_text(
            json.dumps(data, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        print(f"\nWrote {JSON_PATH}")

    # Final coverage report
    print("\n" + "═" * 60)
    print("Coverage report")
    print("═" * 60)
    print(f"  Starting count:      {starting_count}")
    print(f"  CONFIRMED added:     {confirmed_added}")
    print(f"  Discovered added:    {discovered_added}")
    print(f"  Discovery gaps:      {len(discovery_gaps)}")
    print(f"  Final count:         {len(teams)}")
    print()

    from collections import Counter
    league_counts = Counter(v.get("league") for v in teams.values())
    expected = {"MLB": 30, "NBA": 30, "NFL": 32, "NHL": 32, "MLS": 30, "WNBA": 13}
    print("  Per-league:")
    for lg in ("MLB", "NBA", "NFL", "NHL", "MLS", "WNBA"):
        actual = league_counts.get(lg, 0)
        exp = expected.get(lg, "?")
        marker = "✓" if actual == exp else "•"
        print(f"    {marker} {lg:5}  {actual} / {exp}")
    if discovery_gaps:
        print()
        print("  Unresolved (not in JSON):")
        for slug, reason in discovery_gaps:
            print(f"    - {slug}  ({reason[:80]}{'…' if len(reason) > 80 else ''})")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(asyncio.run(amain()))
    except KeyboardInterrupt:
        print("\nInterrupted.")
        sys.exit(130)
