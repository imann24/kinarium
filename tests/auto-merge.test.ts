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
    branch: { protected: false } as { protected?: boolean },
    pages: [[structuredClone(pr)]] as unknown[][],
    error: '',
    mergeResult: { merged: true, sha: 'b'.repeat(40) },
  };
}
type Fixture = ReturnType<typeof fixture>;

function run(data: Fixture) {
  const directory = mkdtempSync(join(tmpdir(), 'kinarium-auto-merge-'));
  const output = join(directory, 'output');
  const calls = join(directory, 'calls');
  writeFileSync(output, '');
  writeFileSync(calls, '');
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
else if (route.endsWith('/pulls?state=open&per_page=100')) response = data.pages;
else process.exit(98);
process.stdout.write(JSON.stringify(response));
`, { mode: 0o755 });
  const env = {
    ...process.env, PATH: `${directory}:${process.env.PATH}`, GH_TOKEN: 'mock-only',
    GITHUB_REPOSITORY: repository, TESTED_SHA: sha, GITHUB_OUTPUT: output,
    FIXTURE: JSON.stringify(data), CALLS: calls,
  };
  try {
    const preflight = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', scripts[0]], { env, encoding: 'utf8' });
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
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe('safe native branch cleanup before auto-merge', () => {
  it('preserves event/job guards, token scope, and avoids checkout or event-dependent cleanup', () => {
    expect(scripts).toHaveLength(2);
    expect(workflow).toContain('types: [opened, reopened, synchronize, ready_for_review]');
    expect(workflow).toContain("github.event.pull_request.user.login == 'imann24'");
    expect(workflow).toContain('github.event.pull_request.draft == false');
    expect(workflow).toContain('github.event.pull_request.head.repo.full_name == github.repository');
    expect(workflow).toContain("if: steps.cleanup.outputs.eligible == 'true'");
    expect(workflow).toContain("if: github.event_name == 'workflow_run'");
    expect(workflow).toContain('workflows: [Test]');
    expect(workflow).toContain('contents: write\n  pull-requests: write');
    expect(workflow).not.toContain('uses:');
  });

  it('uses native deletion after an atomic squash merge of the validated tested head', () => {
    const result = run(fixture());
    expect(result.status).toBe(0);
    expect(result.mergeStatus).toBe(0);
    expect(result.calls.at(-1)).toEqual([
      'api', '--method', 'PUT', `repos/${repository}/pulls/42/merge`, '-f', `sha=${sha}`, '-f', 'merge_method=squash',
    ]);
    expect(result.calls).toContainEqual(['api', `repos/${repository}/branches/feature%2Ftest`]);
    expect(result.calls).toContainEqual(['api', '--paginate', '--slurp', `repos/${repository}/pulls?state=open&per_page=100`]);
    // No delete API call and no gh --delete-branch: GitHub deletes only after merge.
    expect(result.calls.flat()).not.toContain('--delete-branch');
    expect(result.calls.flat()).not.toContain('DELETE');
  });

  const rejected: [string, (data: Fixture) => void][] = [
    ['native deletion disabled', d => { d.repository.delete_branch_on_merge = false; }],
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

  const jobGuard = workflow.match(/    if: >-\n([\s\S]+?)    runs-on:/)![1].trim();
  const completion = () => ({
    event_name: 'workflow_run', repository,
    event: { workflow_run: { conclusion: 'success', event: 'pull_request', head_repository: { full_name: repository } } },
  });
  it('accepts only successful same-repository pull-request Test completions', () => {
    expect(runInNewContext(jobGuard, { github: completion() })).toBe(true);
    for (const conclusion of ['failure', 'cancelled', 'skipped', 'timed_out', 'action_required']) {
      const github = completion();
      github.event.workflow_run.conclusion = conclusion;
      expect(runInNewContext(jobGuard, { github })).toBe(false);
    }
    const push = completion(); push.event.workflow_run.event = 'push';
    expect(runInNewContext(jobGuard, { github: push })).toBe(false);
    const fork = completion(); fork.event.workflow_run.head_repository.full_name = 'other/kinarium';
    expect(runInNewContext(jobGuard, { github: fork })).toBe(false);
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
