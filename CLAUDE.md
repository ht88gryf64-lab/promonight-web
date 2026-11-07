# Working rules for this repo

## Staging: explicit paths only. Never `git add -A`.

`git add -A` / `git add .` / `git commit -a` are **banned in this repo**, in
every worktree. Stage the files you changed, by name:

```bash
git add src/lib/cfb/editorial.ts src/lib/cfb/data.ts   # yes
git add -A                                             # NO
```

**Why.** `audit/` holds 62 tracked deliverable documents and, at any moment,
several dozen untracked in-flight ones — NHL arena wave reports, sweep output,
scratch build scripts. `outputs/` is the same mix. A single `git add -A` sweeps
whatever is in flight into an unrelated feature commit. This happened twice on
2026-09-20 in one session, once on the first commit of a branch and once on an
`--amend`; both times the commit had to be rebuilt with explicit paths and the
working tree restored from the bad commit's own tree.

**A .gitignore does not fix this.** The dangerous files are the loose
`audit/*.md` reports, which must stay committable — ignoring them would hide
deliverables instead of protecting them. Only the pure scratch working
directories are ignored (`audit/nhl-wave*/`), which trims the blast radius but
does not remove it. The rule is the fix.

**Check before every commit:** `git status --short | grep -v '^??'` should list
exactly the files you intend, and nothing else. Then `git show --stat
--name-only --format="" HEAD` after committing, to confirm.

**If it happens anyway:** do not `reset --hard`. The untracked files exist only
in the bad commit's tree. Recover with
`git checkout <bad-sha> -- audit/ outputs/ && git reset HEAD audit/ outputs/`,
which restores them to untracked, then rebuild the commit with explicit paths.

## Verify against served HTML, never a source grep

A change is verified when it is visible in the bytes a crawler receives, not
when the code reads correctly. See `docs/known-issues.md` entry 33 for the two
failure modes and both runnable checks. Counting occurrences needs
`grep -o <pattern> file | wc -l` — the served HTML is effectively one line, so
`grep -c` reports 1 for "present" and hides the real count.

**`npm run test:live` runs after every production deploy, no exceptions.** It
is the live battery (sitemap-to-team-page links, the 950,000-byte team-page
cap, meta descriptions, ads.txt, bot agents, nofollow, robots on images, the
General guide tripwire). On 2026-11-07 a row-markup change took the Twins
page 470 bytes over the cap and it was found only after the next deploy,
because the battery was not run after the first one.

## Anything on a Firestore doc that reaches a client component is published

A server component passing a doc to a client component serializes **every**
field into the RSC flight payload, which is served in the HTML whether or not
anything renders it. Gate at the mapper (`mapPromoDoc`, `mapTeamDoc`,
`getVenueForTeam`), not at the JSX. See `audit/rsc-payload-field-sweep.md`.
