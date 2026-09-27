#!/usr/bin/env node
import { copyFile as fsCopyFile, lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { PAGES_RUNTIME_FILES } from './pages-runtime-allowlist.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUTPUT_DIR = join(REPO_ROOT, 'dist-pages');
const OUTPUT_DIR = resolve(process.env.LANDOS_PAGES_OUTPUT_DIR || DEFAULT_OUTPUT_DIR);
const commit = process.env.LANDOS_BUILD_SHA || '';
const releaseVersion = process.env.LANDOS_RELEASE_VERSION || '';
const builtAt = process.env.LANDOS_BUILT_AT || '';
const deploymentRun = process.env.LANDOS_DEPLOYMENT_RUN || '';

function assertBuildInputs() {
  const outputFromTemp = relative(resolve(tmpdir()), OUTPUT_DIR);
  const isTestTempOutput = outputFromTemp.split(sep)[0]?.startsWith('landos-pages-build-') && !isAbsolute(outputFromTemp);
  if (OUTPUT_DIR !== DEFAULT_OUTPUT_DIR && !isTestTempOutput) {
    throw new Error('LANDOS_PAGES_OUTPUT_DIR must be a dedicated output directory, not a repository/root directory.');
  }
  if (!/^[a-f0-9]{40}$/i.test(commit)) throw new Error('LANDOS_BUILD_SHA must be a full 40-character Git SHA.');
  const releaseParts = /^(\d{4}-\d{2}-\d{2})-([1-9]\d*)$/.exec(releaseVersion);
  const releaseDate = releaseParts ? new Date(`${releaseParts[1]}T00:00:00Z`) : null;
  if (!releaseParts || Number.isNaN(releaseDate.getTime()) || releaseDate.toISOString().slice(0, 10) !== releaseParts[1]) {
    throw new Error('LANDOS_RELEASE_VERSION must use a real UTC date and a positive run number (YYYY-MM-DD-N).');
  }
  if (releaseParts[2] !== deploymentRun) throw new Error('LANDOS_RELEASE_VERSION sequence must match LANDOS_DEPLOYMENT_RUN.');
  if (!Number.isFinite(Date.parse(builtAt))) throw new Error('LANDOS_BUILT_AT must be an ISO timestamp.');
  if (!/^\d+$/.test(deploymentRun)) throw new Error('LANDOS_DEPLOYMENT_RUN must be a numeric workflow run number.');
}

async function copyRuntimeAllowlist() {
  try {
    await lstat(OUTPUT_DIR);
    throw new Error(`Deployment output already exists; refusing to overwrite it: ${OUTPUT_DIR}`);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  await mkdir(OUTPUT_DIR, { recursive: true });
  const copyRuntimeFile = async (path) => {
    const source = resolve(REPO_ROOT, path);
    const destination = resolve(OUTPUT_DIR, path);
    const relativeDestination = relative(OUTPUT_DIR, destination);
    if (relativeDestination.startsWith(`..${sep}`) || relativeDestination === '..') {
      throw new Error(`Runtime path escapes the deployment directory: ${path}`);
    }
    await mkdir(dirname(destination), { recursive: true });
    const sourceStat = await lstat(source);
    if (!sourceStat.isFile() || sourceStat.isSymbolicLink()) throw new Error(`Refusing to publish non-regular tracked path: ${path}`);
    await fsCopyFile(source, destination);
  };
  for (const path of PAGES_RUNTIME_FILES) await copyRuntimeFile(path);
}

async function assertPrecacheTargetsExist(serviceWorker) {
  const precacheBlock = /const PRECACHE_URLS = \[([\s\S]*?)\n\];/.exec(serviceWorker);
  if (!precacheBlock) throw new Error('Could not read the service worker precache list.');
  const paths = [...precacheBlock[1].matchAll(/^\s*'([^']+)'\s*,?\s*$/gm)].map((match) => match[1]);
  if (!paths.length) throw new Error('The service worker precache list is empty or malformed.');
  for (const urlPath of paths) {
    const targetUrl = new URL(urlPath, 'https://pages-artifact.invalid/landos-world/');
    if (targetUrl.origin !== 'https://pages-artifact.invalid' || targetUrl.search || targetUrl.hash) {
      throw new Error(`Unsupported service worker precache URL: ${urlPath}`);
    }
    const relativePath = targetUrl.pathname.replace(/^\/landos-world\//, '');
    const artifactPath = relativePath || 'index.html';
    if (!relativePath && urlPath !== './') throw new Error(`Precache URL escapes or misses the artifact root: ${urlPath}`);
    const targetPath = resolve(OUTPUT_DIR, artifactPath);
    const relativeTarget = relative(OUTPUT_DIR, targetPath);
    if (relativeTarget.startsWith(`..${sep}`) || relativeTarget === '..' || isAbsolute(relativeTarget)) {
      throw new Error(`Precache URL escapes the deployment artifact: ${urlPath}`);
    }
    let targetStat;
    try {
      targetStat = await lstat(targetPath);
    } catch (error) {
      if (error?.code === 'ENOENT') throw new Error(`Service worker precache target is missing: ${urlPath}`);
      throw error;
    }
    if (!targetStat.isFile() || targetStat.isSymbolicLink()) {
      throw new Error(`Service worker precache target is not a regular artifact file: ${urlPath}`);
    }
  }
}

async function writeDeploymentMetadata() {
  const shortCommit = commit.slice(0, 7);
  const metadata = {
    environment: 'production',
    appVersion: releaseVersion,
    releaseVersion,
    branch: 'main',
    commit: shortCommit,
    commitFull: commit,
    shortCommit,
    builtAt: new Date(builtAt).toISOString(),
    generatedAt: new Date(builtAt).toISOString(),
    deploymentRun,
    dirty: false,
    sourceId: commit,
  };
  const metadataJson = JSON.stringify(metadata, null, 2);
  await writeFile(join(OUTPUT_DIR, 'deployment-version.json'), `${metadataJson}\n`, 'utf8');
  await writeFile(join(OUTPUT_DIR, '.nojekyll'), '', 'utf8');
  await writeFile(
    join(OUTPUT_DIR, 'js/landos-world-build-metadata.js'),
    `window.LandoWorldBuildMetadata = Object.freeze(${JSON.stringify(metadata)});\n`,
    'utf8',
  );

  const serviceWorkerPath = join(OUTPUT_DIR, 'service-worker.js');
  const template = await readFile(serviceWorkerPath, 'utf8');
  const replacements = {
    __LANDOS_BUILD_SHORT_SHA__: shortCommit,
    __LANDOS_RELEASE_VERSION__: releaseVersion,
    __LANDOS_BUILD_SHA__: commit,
    __LANDOS_BUILT_AT__: metadata.builtAt,
    __LANDOS_DEPLOYMENT_RUN__: deploymentRun,
  };
  let serviceWorker = template;
  for (const [token, value] of Object.entries(replacements)) serviceWorker = serviceWorker.replaceAll(token, value);
  if (serviceWorker.includes('__LANDOS_')) throw new Error('Service worker still contains an unresolved build token.');
  await assertPrecacheTargetsExist(serviceWorker);
  await writeFile(serviceWorkerPath, serviceWorker, 'utf8');
}

assertBuildInputs();
await copyRuntimeAllowlist();
await writeDeploymentMetadata();
console.log(`Prepared GitHub Pages artifact ${releaseVersion} (${commit.slice(0, 7)}).`);
