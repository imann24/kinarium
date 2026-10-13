# Repository automation

`Test` runs type checking and unit tests on pull requests and pushes to `main`.
`Auto Merge` waits for a successful pull-request `Test` completion for the exact
current head before squash-merging non-draft, same-repository PRs by `imann24`.
The merge API receives that head SHA and still enforces repository branch rules.
It does not use the deferred `gh pr merge --auto` path, which can fail when branch
protection is not configured. Failed, cancelled, outdated, or fork tests cannot
authorize a merge. `Test` also runs when a draft is marked ready for review, so
that transition can authorize a merge after the new run succeeds.

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

The `workflow_run` handler executes from the default branch, checks out no PR
code, and consumes no artifacts. Its token retains only `contents: write` and
`pull-requests: write`; no additional credentials or permission grants are used.
The new handler must first land on the default branch to become active. Existing
successful Test runs are not replayed automatically; run Test again after that
bootstrap if an eligible PR is still waiting.

## Deployment

GitHub Actions no longer deploys to Cloudflare: the former `deploy.yml` workflow
has been removed, including its push and manual-dispatch entrypoints. Cloudflare
will own deployment automation, configured separately by the repository owner.
The app's build configuration, `pnpm build`, local `pnpm deploy` command, Wrangler
configuration, and stored Cloudflare credentials are unchanged. No GitHub workflow
calls that deployment command, dispatches deployment, or provisions Cloudflare
resources. The deleted workflow remains recoverable from Git history.
