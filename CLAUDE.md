# Working rules for this repo

## Worktrees: every session in its own. The shared checkout stays on main.

Every Claude Code session works in its own git worktree (`git worktree add <scratch>/<name> -b <branch> origin/main`), builds and tests there, and merges to main from a worktree too. The shared checkout at `~/promonight-web` is **never switched off main**, not for a feature branch, not for a quick look, not for a merge.

**Why.** On 2026-11-08 one session switched the shared checkout to its feature branch (with uncommitted work) between another session's steps. The second session's `git merge --no-ff` then landed on the first session's branch, and its `git push origin main` reported "up-to-date" because main had not moved. It was caught and undone (`git reset --keep` to that branch's own tip, after confirming from its reflog that the merge was the only commit and no file overlapped), but two sessions sharing one checkout means each one's `git` commands act on the other's state.

**How.** Before any merge, `git branch --show-current` in the directory you are in. Merge from a worktree that checks out main itself (main can be checked out in only one worktree at a time, so remove that worktree, or detach it, as soon as the push is done). If the shared checkout is on a branch that is not main, leave it alone and tell the owner; do not switch it back over someone's uncommitted work.

**PROMO_PIPELINE_DIR.** The pipeline-copy tests (`src/lib/__tests__/revalidate-path-re.test.ts`) read the pipeline's `lib/revalidate-notify.js` and `lib/promo-pages-notify.js` from `../promonight/promo-pipeline`, a sibling of the shared checkout that a scratch worktree does not have. Run the suite from a worktree as `PROMO_PIPELINE_DIR=/Users/mattkovalik/promonight/promo-pipeline npm test` (an absolute path). Without the directory those tests print SKIPPED in red and skip; they never pass by default.

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

## Merge rules

Any diff touching src/components/ or a page route under src/app/
runs the ux-review agent before merge, on the branch dev server,
against every page type the diff touches, in baseline mode against
production. The report is committed with the change at
docs/ux-review/. Every defect in the report is fixed, deferred with a
known-issues entry, or waived with a reason written in the report.
A merge without a report for a qualifying diff is a process defect.

The agent is `.claude/agents/ux-review.md`. It takes URLs or a page type
(promo, team, venue, aggregator, home), each type bound to a fixed sample
path recorded in the agent file; baseline mode needs the branch dev
server (`PROMO_PAGES_LIVE=true PORT=3100 npm run dev`) and production.

## Anything on a Firestore doc that reaches a client component is published

A server component passing a doc to a client component serializes **every**
field into the RSC flight payload, which is served in the HTML whether or not
anything renders it. Gate at the mapper (`mapPromoDoc`, `mapTeamDoc`,
`getVenueForTeam`), not at the JSX. See `audit/rsc-payload-field-sweep.md`.
