import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(new URL('../.github/workflows/auto-merge.yml', import.meta.url), 'utf8');
// Exercise the actual inline workflow scripts, without executing real gh commands.
const scripts = [...workflow.matchAll(/        run: \|\n((?:          .*\n|\n)+)/g)]
  .map(match => match[1].replace(/^          /gm, ''));
const repository = 'imann24/kinarium';
const sha = 'a'.repeat(40);
function fixture() {
  const pr = {
      number: 42, state: 'open', draft: false, merged: false,
      user: { login: 'imann24' },
      head: { ref: 'feature/test', sha, repo: { full_name: repository } },
      base: { ref: 'main', repo: { full_name: repository } },
  };
  return {
    repository: { delete_branch_on_merge: true, default_branch: 'main' },
    pr,
    branch: { protected: false, commit: { sha } } as { protected?: boolean; commit: { sha: string } },
    pages: [[structuredClone(pr)]] as unknown[][],
    refs: [{ ref: 'refs/heads/feature/test' }],
    gitExit: 0,
    error: '',
    mergeResult: { merged: true, sha: 'b'.repeat(40) },
  };
}
type Fixture = ReturnType<typeof fixture>;

function run(data: Fixture, mode: 'merge' | 'cleanup' = 'merge') {
  const directory = mkdtempSync(join(tmpdir(), 'kinarium-auto-merge-'));
  const output = join(directory, 'output');
  const calls = join(directory, 'calls');
  const gitCalls = join(directory, 'git-calls');
  writeFileSync(output, '');
  writeFileSync(calls, '');
  writeFileSync(gitCalls, '');
  writeFileSync(join(directory, 'git'), `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.GIT_CALLS, JSON.stringify(args) + '\\n');
if (args.includes('push')) process.exit(JSON.parse(process.env.FIXTURE).gitExit);
if (args[0] !== 'init') process.exit(99);
`, { mode: 0o755 });
  writeFileSync(join(directory, 'gh'), `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const data = JSON.parse(process.env.FIXTURE);
fs.appendFileSync(process.env.CALLS, JSON.stringify(args) + '\\n');
if (args[0] !== 'api' || args.includes('-X')) process.exit(99);
const route = args.find(value => value.startsWith('repos/'));
if (data.error && route.includes(data.error)) process.exit(1);
let response;
if (route.endsWith('/merge') && args[1] === '--method' && args[2] === 'PUT') response = data.mergeResult;
else if (args.includes('--method')) process.exit(99);
else if (route === 'repos/${repository}') response = data.repository;
else if (route.endsWith('/pulls/42')) response = data.pr;
else if (route.includes('/branches/')) response = data.branch;
else if (route.includes('/git/matching-refs/')) response = data.refs;
else if (route.endsWith('/pulls?state=open&per_page=100')) response = data.pages;
else process.exit(98);
process.stdout.write(JSON.stringify(response));
`, { mode: 0o755 });
  const env = {
    ...process.env, PATH: `${directory}:${process.env.PATH}`, GH_TOKEN: 'mock-only',
    GITHUB_REPOSITORY: repository, PR_NUMBER: '42', TESTED_SHA: sha, GITHUB_OUTPUT: output,
    GITHUB_SERVER_URL: 'https://github.com', HEAD_SHA: sha,
    FIXTURE: JSON.stringify(data), CALLS: calls, GIT_CALLS: gitCalls,
  };
  try {
    const preflight = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', scripts[mode === 'merge' ? 0 : 2]], { env, encoding: 'utf8' });
    const values = Object.fromEntries(readFileSync(output, 'utf8').trim().split('\n').map(line => line.split('=')));
    let mergeStatus: number | null = null;
    if (preflight.status === 0 && values.eligible === 'true') {
      const merge = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', scripts[1]], {
        env: { ...env, HEAD_SHA: values.sha, PR_NUMBER: values.number }, encoding: 'utf8',
      });
      mergeStatus = merge.status;
    }
    return {
      status: preflight.status, mergeStatus, output: preflight.stdout, values,
      calls: readFileSync(calls, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line) as string[]),
      gitCalls: readFileSync(gitCalls, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line) as string[]),
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe('safe auto-merge and branch cleanup', () => {
  it('preserves event/job guards, token scope, and avoids checkout or event-dependent cleanup', () => {
    expect(scripts).toHaveLength(3);
    expect(workflow).toContain('types: [opened, reopened, synchronize, ready_for_review]');
    expect(workflow).toContain("github.event.pull_request.user.login == 'imann24'");
    expect(workflow).toContain('github.event.pull_request.draft == false');
    expect(workflow).toContain('github.event.pull_request.head.repo.full_name == github.repository');
    expect(workflow).toContain("if: steps.cleanup.outputs.eligible == 'true'");
    expect(workflow).toContain('needs: test');
    expect(workflow).toContain('uses: ./.github/workflows/test.yml');
    expect(workflow).not.toContain('workflow_run:');
    expect(workflow).not.toContain('secrets: inherit');
    const mergeJob = workflow.split('  enable-auto-merge:\n')[1];
    expect(mergeJob).toContain('contents: write\n      pull-requests: write');
    expect(mergeJob).not.toContain('uses:');
    const testJob = workflow.split('  test:\n')[1].split('  enable-auto-merge:\n')[0];
    expect(testJob).toContain('contents: read');
    expect(testJob).not.toContain('write');
    const testWorkflow = readFileSync(new URL('../.github/workflows/test.yml', import.meta.url), 'utf8');
    expect(testWorkflow).toContain('workflow_call:');
    expect(testWorkflow).toContain('persist-credentials: false');
    expect(testWorkflow).toContain('contents: read');
    expect(testWorkflow).not.toContain('continue-on-error');
    expect(testWorkflow).toContain('run: pnpm check');
    expect(testWorkflow).toContain('run: pnpm test');
  });

  it('requests an atomic squash merge of the validated tested head', () => {
    const result = run(fixture());
    expect(result.status).toBe(0);
    expect(result.mergeStatus).toBe(0);
    expect(result.calls.at(-1)).toEqual([
      'api', '--method', 'PUT', `repos/${repository}/pulls/42/merge`, '-f', `sha=${sha}`, '-f', 'merge_method=squash',
    ]);
    expect(result.calls).toContainEqual(['api', `repos/${repository}/branches/feature%2Ftest`]);
    expect(result.calls).toContainEqual(['api', '--paginate', '--slurp', `repos/${repository}/pulls?state=open&per_page=100`]);
    // The merge step never deletes a branch before success is confirmed.
    expect(result.calls.flat()).not.toContain('--delete-branch');
    expect(result.calls.flat()).not.toContain('DELETE');
  });

  const rejected: [string, (data: Fixture) => void][] = [
    ['missing default branch', d => { d.repository.default_branch = ''; }],
    ['default head branch', d => { d.pr.head.ref = 'main'; d.pr.base.ref = 'release'; }],
    ['base head branch', d => { d.pr.head.ref = 'release'; d.pr.base.ref = 'release'; }],
    ['protected head branch', d => { d.branch.protected = true; }],
    ['unknown branch protection', d => { delete d.branch.protected; }],
    ['draft PR', d => { d.pr.draft = true; }],
    ['different author', d => { d.pr.user.login = 'someone-else'; }],
    ['fork PR', d => { d.pr.head.repo.full_name = 'someone/kinarium'; }],
    ['different base repository', d => { d.pr.base.repo.full_name = 'someone/kinarium'; }],
    ['closed unmerged PR', d => { d.pr.state = 'closed'; }],
    ['already merged PR', d => { d.pr.state = 'closed'; d.pr.merged = true; }],
    ['invalid head SHA', d => { d.pr.head.sha = 'not-a-sha'; }],
    ['head changed since Test succeeded', d => { d.pr.head.sha = 'c'.repeat(40); }],
    ['no matching open PR', d => { d.pages = [[]]; }],
    ['branch API failure', d => { d.error = '/branches/'; }],
    ['repository API failure', d => { d.error = 'repos/'; }],
    ['PR list API failure', d => { d.error = '?state=open'; }],
    ['another PR targets this head', d => { d.pages.push([{ ...d.pr, number: 43, base: { ref: 'feature/test' } }]); }],
    ['another PR uses this head', d => { d.pages.push([{ ...d.pr, number: 43 }]); }],
  ];
  it.each(rejected)('does not merge or delete with %s', (_name, modify) => {
    const data = fixture();
    modify(data);
    const result = run(data);
    expect(result.values.eligible).not.toBe('true');
    expect(result.calls.every(call => !call.includes('--method'))).toBe(true);
    expect(result.calls.flat()).not.toContain('DELETE');
  });

  it('keeps branch names as API data, including shell metacharacters', () => {
    const data = fixture();
    data.pr.head.ref = 'feature/$(false);name';
    const result = run(data);
    expect(result.status).toBe(0);
    expect(result.calls).toContainEqual(['api', `repos/${repository}/branches/feature%2F%24%28false%29%3Bname`]);
  });

  it.each(['rejected', 'API failure'])('fails when the guarded merge is %s', kind => {
    const data = fixture();
    if (kind === 'rejected') data.mergeResult.merged = false;
    else data.error = '/merge';
    const result = run(data);
    expect(result.mergeStatus).not.toBe(0);
    expect(result.calls.flat()).not.toContain('DELETE');
  });

  function mergedFixture() {
    const data = fixture();
    data.pr.merged = true;
    data.pr.state = 'closed';
    data.pages = [[]];
    return data;
  }

  it.each([true, false])('deletes the exact merged head with a SHA lease (native deletion=%s)', nativeDeletion => {
    const data = mergedFixture();
    data.repository.delete_branch_on_merge = nativeDeletion;
    const result = run(data, 'cleanup');
    expect(result.status).toBe(0);
    const push = result.gitCalls.find(call => call.includes('push'))!;
    expect(push.slice(2)).toEqual([
      '-c', 'credential.helper=', '-c', 'credential.helper=!gh auth git-credential',
      'push', `--force-with-lease=refs/heads/feature/test:${sha}`,
      `https://github.com/${repository}.git`, ':refs/heads/feature/test',
    ]);
    expect(workflow).toContain("if: steps.merge.outcome == 'success'");
  });

  const keepBranches: [string, (data: Fixture) => void][] = [
    ['open PR', d => { d.pr.merged = false; d.pr.state = 'open'; }],
    ['closed unmerged PR', d => { d.pr.merged = false; }],
    ['different author', d => { d.pr.user.login = 'other'; }],
    ['fork head', d => { d.pr.head.repo.full_name = 'other/kinarium'; }],
    ['different merged head', d => { d.pr.head.sha = 'c'.repeat(40); }],
    ['default head', d => { d.repository.default_branch = 'feature/test'; }],
    ['base head', d => { d.pr.base.ref = 'feature/test'; }],
    ['protected branch', d => { d.branch.protected = true; }],
    ['unknown protection', d => { delete d.branch.protected; }],
    ['new unmerged commits', d => { d.branch.commit.sha = 'd'.repeat(40); }],
    ['already deleted', d => { d.refs = []; }],
    ['only prefix matches', d => { d.refs = [{ ref: 'refs/heads/feature/test-other' }]; }],
    ['open head reuse', d => { d.pages.push([{ ...d.pr, number: 99 }]); }],
    ['open base reuse', d => { d.pages.push([{ base: { ref: 'feature/test' } }]); }],
    ['metadata API failure', d => { d.error = '/pulls/42'; }],
    ['protection API failure', d => { d.error = '/branches/'; }],
    ['missing default metadata', d => { d.repository.default_branch = ''; }],
  ];
  it.each(keepBranches)('does not delete for %s', (_name, modify) => {
    const data = mergedFixture();
    modify(data);
    const result = run(data, 'cleanup');
    expect(result.gitCalls).toEqual([]);
    expect(result.calls.flat()).not.toContain('DELETE');
  });

  it('surfaces a rejected SHA lease instead of reporting successful cleanup', () => {
    const data = mergedFixture();
    data.gitExit = 1;
    const result = run(data, 'cleanup');
    expect(result.status).not.toBe(0);
    expect(result.output).not.toContain('Deleted the unchanged merged feature branch.');
  });

  it('proves a real Git SHA lease refuses deletion after a concurrent push', () => {
    const directory = mkdtempSync(join(tmpdir(), 'kinarium-lease-'));
    const remote = join(directory, 'remote.git');
    const source = join(directory, 'source');
    const cleanup = join(directory, 'cleanup');
    const git = (...args: string[]) => spawnSync('git', args, { encoding: 'utf8' });
    const ok = (...args: string[]) => {
      const result = git(...args);
      expect(result.status, result.stderr).toBe(0);
      return result.stdout.trim();
    };
    try {
      ok('init', '--bare', remote);
      ok('init', source);
      ok('init', cleanup);
      const commit = (message: string) => ok('-C', source, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '--allow-empty', '-m', message);
      commit('merged content');
      const mergedSha = ok('-C', source, 'rev-parse', 'HEAD');
      ok('-C', source, 'push', remote, 'HEAD:refs/heads/feature');
      commit('new unmerged content');
      const newSha = ok('-C', source, 'rev-parse', 'HEAD');
      ok('-C', source, 'push', remote, 'HEAD:refs/heads/feature');
      const stale = git('-C', cleanup, 'push', `--force-with-lease=refs/heads/feature:${mergedSha}`, remote, ':refs/heads/feature');
      expect(stale.status).not.toBe(0);
      expect(ok('ls-remote', remote, 'refs/heads/feature')).toContain(newSha);
      ok('-C', cleanup, 'push', `--force-with-lease=refs/heads/feature:${newSha}`, remote, ':refs/heads/feature');
      expect(ok('ls-remote', remote, 'refs/heads/feature')).toBe('');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  const jobGuard = workflow.split('  enable-auto-merge:\n')[1].match(/    if: >-\n([\s\S]+?)    runs-on:/)![1].trim();
  const completion = () => ({
    github: { repository, event: { pull_request: fixture().pr } },
    needs: { test: { result: 'success' } },
  });
  it('requires a successful Test dependency in the same run and eligible PR metadata', () => {
    expect(runInNewContext(jobGuard, completion())).toBe(true);
    for (const conclusion of ['failure', 'cancelled', 'skipped', 'timed_out', 'action_required']) {
      const context = completion();
      context.needs.test.result = conclusion;
      expect(runInNewContext(jobGuard, context)).toBe(false);
    }
    const fork = completion(); fork.github.event.pull_request.head.repo.full_name = 'other/kinarium';
    expect(runInNewContext(jobGuard, fork)).toBe(false);
    const draft = completion(); draft.github.event.pull_request.draft = true;
    expect(runInNewContext(jobGuard, draft)).toBe(false);
    const otherAuthor = completion(); otherAuthor.github.event.pull_request.user.login = 'other';
    expect(runInNewContext(jobGuard, otherAuthor)).toBe(false);
  });

  it('has no active Cloudflare deployment workflow or invocation', () => {
    const directory = new URL('../.github/workflows/', import.meta.url);
    const files = readdirSync(directory).filter(file => /\.ya?ml$/.test(file));
    expect(files).not.toContain('deploy.yml');
    for (const file of files) {
      expect(readFileSync(new URL(file, directory), 'utf8')).not.toMatch(/wrangler\s+deploy|pnpm\s+(?:run\s+)?deploy|CLOUDFLARE_API_TOKEN|workflow_dispatch/);
    }
  });
});
