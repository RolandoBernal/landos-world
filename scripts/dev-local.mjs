#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOCAL_DIR = join(REPO_ROOT, '.local');
const METADATA_PATH = join(LOCAL_DIR, 'landos-world-build-metadata.js');
const DEFAULT_PORT = 8000;
const REQUIRED_MARKERS = ['package.json', 'index.html', 'service-worker.js', 'manifest.webmanifest', 'js', 'css'];
const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

function git(args, fallback = '') {
  try {
    return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
  } catch {
    return fallback;
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const portIndex = args.indexOf('--port');
  const port = portIndex >= 0 ? Number(args[portIndex + 1]) : DEFAULT_PORT;
  return { port, quiet: args.includes('--quiet') };
}

function verifyRepositoryRoot() {
  const missing = REQUIRED_MARKERS.filter((marker) => !existsSync(join(REPO_ROOT, marker)));
  if (missing.length) {
    throw new Error(`This does not appear to be the Lando’s World repository root. Missing: ${missing.join(', ')}`);
  }
}

async function fingerprintDirtySource(status, stagedDiff, workingDiff, untrackedFiles) {
  const hash = createHash('sha256');
  hash.update(status);
  hash.update(stagedDiff);
  hash.update(workingDiff);
  for (const file of untrackedFiles.split('\0').filter(Boolean).sort()) {
    hash.update(file);
    try {
      hash.update(await readFile(join(REPO_ROOT, file)));
    } catch {
      hash.update('unreadable');
    }
  }
  return hash.digest('hex').slice(0, 8);
}

async function generateMetadata() {
  const status = git(['status', '--porcelain', '--untracked-files=all']);
  const dirty = Boolean(status);
  const commitFull = git(['rev-parse', 'HEAD'], 'unavailable');
  const commit = commitFull === 'unavailable' ? 'unavailable' : commitFull.slice(0, 7);
  const branch = git(['symbolic-ref', '--short', 'HEAD'], 'detached HEAD');
  const packageData = JSON.parse(await readFile(join(REPO_ROOT, 'package.json'), 'utf8'));
  const sourceId = dirty
    ? `${commit}+dirty.${await fingerprintDirtySource(status, git(['diff', '--cached', '--binary']), git(['diff', '--binary']), git(['ls-files', '--others', '--exclude-standard', '-z']))}`
    : commit;
  const metadata = {
    environment: 'local',
    appVersion: packageData.version || null,
    branch,
    commit,
    commitFull,
    dirty,
    sourceId,
    generatedAt: new Date().toISOString(),
  };
  await mkdir(LOCAL_DIR, { recursive: true });
  await writeFile(METADATA_PATH, `window.LandoWorldBuildMetadata = Object.freeze(${JSON.stringify(metadata)});\n`, 'utf8');
  return metadata;
}

function printBanner(metadata, port) {
  console.log(`Lando’s World — Local Development\n\nURL:       http://127.0.0.1:${port}\nRoot:      ${REPO_ROOT}\nBranch:    ${metadata.branch}\nCommit:    ${metadata.commit}\nSource:    ${metadata.dirty ? 'Modified' : 'Clean'}\nSource ID: ${metadata.sourceId}\nPort:      ${port}\n\nServing current working tree.`);
}

function requestPath(requestUrl) {
  const url = new URL(requestUrl || '/', 'http://127.0.0.1');
  const decoded = decodeURIComponent(url.pathname);
  const normalized = decoded === '/' ? '/index.html' : decoded;
  const filePath = resolve(REPO_ROOT, `.${normalized}`);
  const relativePath = relative(REPO_ROOT, filePath);
  if (relativePath.startsWith(`..${sep}`) || relativePath === '..' || filePath === REPO_ROOT) return null;
  return filePath;
}

async function serveFile(request, response) {
  let filePath;
  try {
    filePath = requestPath(request.url);
    if (!filePath) {
      response.writeHead(403, { 'Cache-Control': 'no-store' });
      response.end('Forbidden');
      return;
    }
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error('Not a file');
  } catch {
    response.writeHead(404, { 'Cache-Control': 'no-store' });
    response.end('Not found');
    return;
  }
  response.writeHead(200, {
    'Cache-Control': 'no-store',
    'Content-Type': CONTENT_TYPES[extname(filePath)] || 'application/octet-stream',
  });
  if (request.method !== 'HEAD') createReadStream(filePath).pipe(response);
  else response.end();
}

async function main() {
  const { port, quiet } = parseArgs();
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`Invalid port: ${port}`);
  verifyRepositoryRoot();
  const metadata = await generateMetadata();
  const server = createServer((request, response) => { serveFile(request, response); });
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use.\n\nLando’s World was NOT started because another server may already be using this port.\nStop the existing server and run pnpm dev again.`);
    } else console.error(`Lando’s World local server failed: ${error.message}`);
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => { if (!quiet) printBanner(metadata, port); });
  const stop = () => server.close(() => process.exit(0));
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

main().catch((error) => {
  console.error(`ERROR: ${error.message}`);
  console.error('Local server was not started.');
  process.exitCode = 1;
});
