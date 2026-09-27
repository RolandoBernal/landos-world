#!/usr/bin/env node
import { createReadStream } from 'node:fs';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { generateMetadata } from './dev-local.mjs';
import { PAGES_RUNTIME_FILES } from './pages-runtime-allowlist.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_PORT = 8000;
const METADATA_PATH = '/.local/landos-world-build-metadata.js';
const METADATA_FILE = '.local/landos-world-build-metadata.js';
const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ttf': 'font/ttf',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};
const RUNTIME_FILES = new Set([...PAGES_RUNTIME_FILES, METADATA_FILE]);

function isPrivateIPv4(address) {
  const octets = address.split('.').map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [first, second] = octets;
  return first === 10
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168);
}

function isLoopbackIPv4(address) {
  return parseIPv4(address) !== null && address.split('.')[0] === '127';
}

function parseIPv4(address) {
  const normalized = address.startsWith('::ffff:') ? address.slice(7) : address;
  const parts = normalized.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return parts.reduce((value, part) => ((value << 8) | part) >>> 0, 0);
}

export function isSameSubnetIPv4(address, interfaceAddress, netmask) {
  const ip = parseIPv4(address);
  const local = parseIPv4(interfaceAddress);
  const mask = parseIPv4(netmask);
  return ip !== null && local !== null && mask !== null && ((ip & mask) >>> 0) === ((local & mask) >>> 0);
}

function findDefaultInterface(routeOutput) {
  return /^\s*interface:\s*(\S+)\s*$/m.exec(routeOutput)?.[1] || '';
}

export function selectLanInterfaceAddress(interfaces, routeOutput) {
  const interfaceName = findDefaultInterface(routeOutput);
  if (!interfaceName) throw new Error('Could not identify the Mac’s default network interface. Connect to a trusted local Wi-Fi network and try again.');
  const candidates = (interfaces[interfaceName] || []).filter((entry) => (
    (entry.family === 'IPv4' || entry.family === 4)
    && !entry.internal
    && isPrivateIPv4(entry.address)
    && parseIPv4(entry.netmask) !== null
  ));
  if (candidates.length !== 1) {
    throw new Error(`Could not safely select one private IPv4 address on ${interfaceName}. Check that the Mac is connected to the intended local network and disconnect any VPN or extra network interfaces before retrying.`);
  }
  return { interfaceName, ...candidates[0] };
}

export function getMacLanInterfaceAddress() {
  let routeOutput;
  try {
    routeOutput = execFileSync('route', ['-n', 'get', 'default'], { encoding: 'utf8', timeout: 3000 });
  } catch {
    throw new Error('Could not inspect the Mac’s default network route. Connect to a trusted local Wi-Fi network and try again.');
  }
  return selectLanInterfaceAddress(networkInterfaces(), routeOutput);
}

function safeRequestPath(requestUrl) {
  const rawPath = String(requestUrl || '/').split(/[?#]/, 1)[0] || '/';
  if (!rawPath.startsWith('/') || rawPath.startsWith('//') || rawPath.includes('\\') || rawPath.includes('\0')) return null;
  const segments = rawPath.slice(1).split('/');
  const decodedSegments = [];
  try {
    for (const segment of segments) {
      const decoded = decodeURIComponent(segment);
      if (decoded === '.' || decoded === '..' || decoded.includes('/') || decoded.includes('\\') || decoded.includes('\0')) return null;
      decodedSegments.push(decoded);
    }
  } catch {
    return null;
  }
  const normalized = `/${decodedSegments.join('/')}`;
  return normalized === '/' ? '/index.html' : normalized;
}

function createMetadataScript(metadata) {
  return `window.LandoWorldBuildMetadata = Object.freeze(${JSON.stringify(metadata)});\n`;
}

function addLocalDeviceMarkup(html) {
  const metadataScript = `<script src="${METADATA_PATH}?v=local-device"></script>`;
  const badge = `<style id="lws-local-dev-style">#lws-local-dev-badge{position:fixed;z-index:2147483000;inset-block-start:calc(env(safe-area-inset-top,0px) + 6px);inset-inline-end:8px;padding:3px 7px;border:1px solid #ffd166;border-radius:999px;background:#332600;color:#fff3c4;font:700 10px/1.2 system-ui,sans-serif;letter-spacing:.08em;pointer-events:none;user-select:none}</style><div id="lws-local-dev-badge" role="status" aria-label="Local development environment">LOCAL DEV</div>`;
  if (!html.includes('</head>') || !html.includes('</body>')) throw new Error('The Lando’s World shell could not be marked as local-device development.');
  return html.replace('</head>', `${metadataScript}</head>`).replace('</body>', `${badge}</body>`);
}

function responseHeaders(filePath) {
  return {
    'Cache-Control': 'no-store',
    'Content-Type': CONTENT_TYPES[extname(filePath)] || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  };
}

export function createIPhoneDevServer({ root = REPO_ROOT, bindAddress, getMetadata }) {
  if (!bindAddress || (!isPrivateIPv4(bindAddress.address) && !isLoopbackIPv4(bindAddress.address))) {
    throw new Error('The iPhone development server requires an explicitly selected private IPv4 interface.');
  }
  if (!bindAddress.netmask || parseIPv4(bindAddress.netmask) === null) {
    throw new Error('A valid IPv4 subnet mask is required for LAN-only access.');
  }
  if (typeof getMetadata !== 'function') throw new Error('An explicit local-device metadata provider is required.');
  const rootPath = resolve(root);

  return createServer(async (request, response) => {
    const remoteAddress = request.socket.remoteAddress || '';
    if (!isSameSubnetIPv4(remoteAddress, bindAddress.address, bindAddress.netmask)) {
      response.writeHead(403, { 'Cache-Control': 'no-store' });
      response.end('Forbidden');
      return;
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD', 'Cache-Control': 'no-store' });
      response.end('Method not allowed');
      return;
    }

    const requestPath = safeRequestPath(request.url);
    const relativePath = requestPath?.slice(1) || '';
    if (!requestPath || !RUNTIME_FILES.has(relativePath)) {
      response.writeHead(404, { 'Cache-Control': 'no-store' });
      response.end('Not found');
      return;
    }

    if (requestPath === METADATA_PATH) {
      try {
        const metadata = await getMetadata();
        response.writeHead(200, responseHeaders(METADATA_FILE));
        response.end(request.method === 'HEAD' ? undefined : createMetadataScript(metadata));
      } catch {
        response.writeHead(503, { 'Cache-Control': 'no-store' });
        response.end('Local metadata unavailable');
      }
      return;
    }

    const targetPath = resolve(rootPath, relativePath);
    let filePath;
    try {
      const [resolvedPath, targetStat] = await Promise.all([realpath(targetPath), lstat(targetPath)]);
      const resolvedRelative = relative(rootPath, resolvedPath);
      if (targetStat.isSymbolicLink() || !targetStat.isFile()
        || resolvedRelative.startsWith(`..${sep}`) || resolvedRelative === '..' || resolvedPath === rootPath) {
        throw new Error('Not an approved regular runtime file');
      }
      filePath = resolvedPath;
    } catch {
      response.writeHead(404, { 'Cache-Control': 'no-store' });
      response.end('Not found');
      return;
    }

    try {
      response.writeHead(200, responseHeaders(filePath));
      if (request.method === 'HEAD') {
        response.end();
        return;
      }
      if (relativePath === 'index.html') {
        const html = addLocalDeviceMarkup(await readFile(filePath, 'utf8'));
        response.end(html);
        return;
      }
      createReadStream(filePath).pipe(response);
    } catch {
      if (!response.headersSent) response.writeHead(500, { 'Cache-Control': 'no-store' });
      response.end('Unable to serve approved runtime file');
    }
  });
}

function parseArgs() {
  const args = process.argv.slice(2);
  const portIndex = args.indexOf('--port');
  return { port: portIndex >= 0 ? Number(args[portIndex + 1]) : DEFAULT_PORT };
}

async function main() {
  const { port } = parseArgs();
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`Invalid port: ${port}`);
  const lan = getMacLanInterfaceAddress();
  const metadata = await generateMetadata({ environment: 'local-device', includeUntracked: false });
  const server = createIPhoneDevServer({
    bindAddress: lan,
    getMetadata: () => generateMetadata({ environment: 'local-device', includeUntracked: false }),
  });
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use on ${lan.address}. Stop that server or choose another port with --port.`);
    } else console.error(`Local iPhone development server failed: ${error.message}`);
    process.exitCode = 1;
  });
  server.listen(port, lan.address, () => {
    console.log(`Lando’s World — Local iPhone Development\n\nURL:       http://${lan.address}:${port}/\nNetwork:   ${lan.interfaceName} (private IPv4; same-subnet clients only)\nBranch:    ${metadata.branch}\nCommit:    ${metadata.commit}\nSource:    ${metadata.dirty ? 'Modified' : 'Clean'}\n\nUse Safari on the iPhone and keep both devices on the same trusted local network.\nmacOS Firewall may ask you to allow incoming connections for Node.js; do not disable the firewall.\nPWA installation, service workers, offline behavior, and deployed-release updates are disabled/not representative.\nLLT authentication and Supabase/production sync are disabled; local changes stay in this browser origin.\nStop the server with Ctrl-C.`);
  });
  const stop = () => server.close(() => process.exit(0));
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`ERROR: ${error.message}`);
    console.error('Local iPhone development server was not started.');
    process.exitCode = 1;
  });
}
