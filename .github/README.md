# Repository automation

`Test` runs type checking and unit tests on pull requests and pushes to `main`.
`Auto Merge` calls that same reusable `Test` workflow as a read-only prerequisite
before squash-merging non-draft, same-repository PRs by `imann24`. The standalone
Test check is retained; eligible PRs additionally run it within Auto Merge so the
dependency is enforced in the same run without polling or extra API permissions.
The merge API receives that head SHA and still enforces repository branch rules.
It does not use the deferred `gh pr merge --auto` path, which can fail when branch
protection is not configured. Failed, cancelled, outdated, or fork tests cannot
authorize a merge. `Test` also runs when a draft is marked ready for review, so
that transition can authorize a merge after the new run succeeds. The tested
PR event's head SHA must still match the live PR before it can merge.

## Branch cleanup

The workflow deletes only its own successfully merged feature head in the same
run. Native automatic deletion is enabled in this repository, but live checks
found merged branches (including PR #17) still present, so the workflow does not
rely on that setting or on a token-suppressed `pull_request: closed` event.

Before merging, the workflow revalidates PR state, author, repository and tested
SHA. It rejects default/base/protected head branches and branches used by another
open PR as head or base. Unknown protection and API failures stop the operation.
After a confirmed merge, it rechecks the merged PR's identity and SHA, the default
and base branches, branch protection, and other open PRs. It keeps a head with
new commits. An exact Git SHA lease rejects deletion if the branch moves between
checking and deleting; there is no force or admin bypass. Already-deleted heads
are a successful no-op. Git uses an empty temporary repository and the existing
token through the CLI credential helper; no code checkout or token persistence
is needed. API/protection/lease failures do not authorize deletion. GitHub's
current branch rules still apply; concurrent administrative changes remain under
their control. No repository settings are changed.

There is no historical sweep. Open/unmerged branches and old merged leftovers
are left alone. Removing historical leftovers requires a separate bounded review
of merged PR status, unchanged head, protection, default/base status and reuse.

The test job has only `contents: read`, does not persist checkout credentials,
and receives no inherited repository secrets. The separate merge job checks out
no code and consumes no artifacts. Only that job retains the existing
`contents: write` and `pull-requests: write` permissions. No additional credentials
or permission grants are used. The local reusable workflow is taken from the
same commit as its caller, so the gate also works on the PR introducing it.
There is no default-branch `workflow_run` bootstrap or second-event dependency.

## Deployment

GitHub Actions no longer deploys to Cloudflare: the former `deploy.yml` workflow
has been removed, including its push and manual-dispatch entrypoints. Cloudflare
will own deployment automation, configured separately by the repository owner.
The app's build configuration, `pnpm build`, local `pnpm deploy` command, Wrangler
configuration, and stored Cloudflare credentials are unchanged. No GitHub workflow
calls that deployment command, dispatches deployment, or provisions Cloudflare
resources. The deleted workflow remains recoverable from Git history.
