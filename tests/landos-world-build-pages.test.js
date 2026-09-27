import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { PAGES_RUNTIME_FILES } from '../scripts/pages-runtime-allowlist.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const buildScript = join(repoRoot, 'scripts/build-pages.mjs');
const pagesWorkflow = await readFile(join(repoRoot, '.github/workflows/pages.yml'), 'utf8');

test('production Pages workflow is restricted to main and uses a unique deployment run label', () => {
  assert.match(pagesWorkflow, /push:\s*\n\s*branches:\s*\[main\]/);
  assert.match(pagesWorkflow, /workflow_dispatch:/);
  assert.match(pagesWorkflow, /if: github\.ref == 'refs\/heads\/main'/);
  assert.match(pagesWorkflow, /LANDOS_BUILD_SHA: \$\{\{ github\.sha \}\}/);
  assert.match(pagesWorkflow, /RUN_NUMBER: \$\{\{ github\.run_number \}\}/);
  assert.match(pagesWorkflow, /git show -s --format=%cI/);
  assert.match(pagesWorkflow, /release_version=\$RELEASE_DATE-\$RUN_NUMBER/);
  assert.doesNotMatch(pagesWorkflow, /pull_request:/);
});

test('Pages artifact embeds one deployment identity in runtime metadata and the worker', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'landos-pages-build-'));
  const output = join(tempRoot, 'artifact');
  const sha = '0123456789abcdef0123456789abcdef01234567';
  const releaseVersion = '2026-09-26-42';
  const builtAt = '2026-09-26T20:46:11.000Z';
  try {
    execFileSync(process.execPath, [buildScript], {
      cwd: repoRoot,
      env: {
        ...process.env,
        LANDOS_PAGES_OUTPUT_DIR: output,
        LANDOS_BUILD_SHA: sha,
        LANDOS_RELEASE_VERSION: releaseVersion,
        LANDOS_BUILT_AT: builtAt,
        LANDOS_DEPLOYMENT_RUN: '42',
      },
      stdio: 'pipe',
    });

    const metadata = JSON.parse(await readFile(join(output, 'deployment-version.json'), 'utf8'));
    const runtimeMetadata = await readFile(join(output, 'js/landos-world-build-metadata.js'), 'utf8');
    const deployedWorker = await readFile(join(output, 'service-worker.js'), 'utf8');
    const pageWindow = {};
    vm.runInNewContext(runtimeMetadata, { window: pageWindow });
    const workerListeners = new Map();
    const workerSelf = {
      location: new URL('https://example.test/landos-world/service-worker.js'),
      addEventListener(type, listener) { workerListeners.set(type, listener); },
    };
    vm.runInNewContext(deployedWorker, {
      self: workerSelf,
      URL,
      Set,
      Request,
      Response,
      caches: {},
      fetch() {},
      console,
      Promise,
    });
    let workerMetadata;
    workerListeners.get('message')({
      data: { type: 'GET_BUILD_METADATA', requestId: 'identity-test' },
      ports: [{ postMessage(response) { workerMetadata = response.metadata; } }],
    });
    assert.equal(metadata.releaseVersion, releaseVersion);
    assert.equal(metadata.commitFull, sha);
    assert.equal(metadata.shortCommit, sha.slice(0, 7));
    assert.equal(metadata.deploymentRun, '42');
    for (const identity of [metadata, pageWindow.LandoWorldBuildMetadata, workerMetadata]) {
      assert.equal(identity.releaseVersion, releaseVersion);
      assert.equal(identity.commitFull, sha);
      assert.equal(identity.shortCommit, sha.slice(0, 7));
      assert.equal(identity.commit, sha.slice(0, 7));
      assert.equal(identity.deploymentRun, '42');
      assert.equal(identity.builtAt, builtAt);
    }
    assert.match(deployedWorker, new RegExp(`const SW_VERSION = '${sha}'`));
    assert.match(deployedWorker, new RegExp(`commitFull: '${sha}'`));
    assert.match(deployedWorker, new RegExp(`commit: '${sha.slice(0, 7)}'`));
    assert.doesNotMatch(deployedWorker, /__LANDOS_/);
    assert.equal(await readFile(join(output, '.nojekyll'), 'utf8'), '');
    await assert.rejects(readFile(join(output, 'LLT_INSULIN_PLAN_RECONCILIATION_DRY_RUN_REPORT.md')));

    const precacheBlock = /const PRECACHE_URLS = \[([\s\S]*?)\n\];/.exec(deployedWorker);
    const precachePaths = [...precacheBlock[1].matchAll(/^\s*'([^']+)'\s*,?\s*$/gm)].map((match) => match[1]);
    for (const urlPath of precachePaths) {
      const artifactPath = urlPath === './' ? 'index.html' : urlPath.replace(/^\.\//, '');
      assert.ok((await readFile(join(output, artifactPath))).byteLength > 0, `missing precache asset ${urlPath}`);
    }
    for (const runtimeFile of PAGES_RUNTIME_FILES) {
      assert.ok((await readFile(join(output, runtimeFile))).byteLength > 0, `missing approved runtime file ${runtimeFile}`);
    }
    for (const excluded of ['package.json', 'pnpm-lock.yaml', 'tests', 'scripts', 'docs', '.github', 'api', 'supabase', 'vercel.json', '.env.example']) {
      await assert.rejects(readFile(join(output, excluded)), { code: 'ENOENT' }, `${excluded} must not be published`);
    }
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('Pages build rejects missing and malformed deployment identity inputs', () => {
  const result = spawnSync(process.execPath, [buildScript], {
    cwd: repoRoot,
    env: {
      ...process.env,
      LANDOS_BUILD_SHA: 'not-a-full-sha',
      LANDOS_RELEASE_VERSION: '1.0.0',
    LANDOS_BUILT_AT: 'not-a-date',
      LANDOS_DEPLOYMENT_RUN: 'x',
    },
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /LANDOS_BUILD_SHA must be a full 40-character Git SHA/);
});
