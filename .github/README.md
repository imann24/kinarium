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

The workflow requires GitHub's existing **Automatically delete head branches**
setting (`delete_branch_on_merge: true`). GitHub performs cleanup only after a
successful merge, including deferred merges initiated outside this workflow.
This avoids both the CLI's deferred `--delete-branch` limitation and relying on
a `pull_request: closed` event suppressed by `GITHUB_TOKEN`.

Before merging, the workflow revalidates PR state, author, repository and tested
SHA. It rejects default/base/protected head branches and branches used by another
open PR as head or base. Unknown protection and API failures stop the operation.
It never issues a branch deletion request or changes repository settings. If
native deletion is disabled later, it fails with an explicit setup error. Rules
may prevent native deletion; the workflow will not override them. Administrative
changes made after these checks remain subject to GitHub's native behavior.

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
