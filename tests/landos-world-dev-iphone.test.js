import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import test from 'node:test';
import https from 'node:https';
import { createServer } from 'node:http';
import {
  createIPhoneDevServer,
  parseArgs,
  readPreviewTls,
  readAuthenticationPreviewConfig,
  isSameSubnetIPv4,
  selectLanInterfaceAddress,
} from '../scripts/dev-iphone.mjs';

function request(server, path, method = 'GET') {
  const address = server.address();
  return new Promise((resolve, reject) => {
    const outgoing = httpRequest({
      host: '127.0.0.1',
      port: address.port,
      path,
      method,
    }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body }));
    });
    outgoing.on('error', reject);
    outgoing.end();
  });
}

async function withServer(run, options = {}) {
  const server = createIPhoneDevServer({
    bindAddress: { address: '127.0.0.1', netmask: '255.0.0.0' },
    getMetadata: async () => ({ environment: 'local-device', commit: 'test-sha' }),
    ...options,
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    await run(server);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

test('auth preview requires valid configuration and serves restrictive policy and trusted identity only', async () => {
  assert.match(await readAuthenticationPreviewConfig(), /^https:\/\/.+\.supabase\.co$/);
  await assert.rejects(readAuthenticationPreviewConfig('/nonexistent-preview-root'));
  await withServer(async (server) => {
    const shell = await request(server, '/?local-device=true&auth-preview=false');
    assert.equal(shell.status, 200);
    assert.match(shell.body, /AUTH PREVIEW/);
    assert.match(shell.body, /Production data access disabled/);
    assert.match(shell.body, /environment.*local-auth-preview/);
    assert.doesNotMatch(shell.body, /<script src="js\/landos-world-build-metadata/);
    assert.equal(shell.headers['content-security-policy'], "connect-src 'self' https://example.supabase.co/auth/v1/; form-action 'self'; worker-src 'none'");
    assert.equal(shell.headers['cache-control'], 'no-store');
    assert.equal((await request(server, '/rest/v1/canary')).status, 404);
    assert.equal((await request(server, '/.local/landos-world-build-metadata.js')).status, 200);
  }, { authOrigin: 'https://example.supabase.co', getMetadata: async () => ({ environment: 'local-auth-preview' }) });
});

test('auth preview missing or wrong metadata fails closed, never serves a production fallback', async () => {
  for (const getMetadata of [async () => null, async () => ({ environment: 'local-device' }), async () => { throw new Error('Unavailable'); }]) {
    await withServer(async (server) => {
      assert.equal((await request(server, '/')).status, 500);
      assert.equal((await request(server, '/.local/landos-world-build-metadata.js')).status, 503);
    }, { authOrigin: 'https://example.supabase.co', getMetadata });
  }
});

test('iPhone dev mode selects exactly one private IPv4 address on the default interface', () => {
  const selected = selectLanInterfaceAddress({
    en0: [
      { address: '192.168.1.24', netmask: '255.255.255.0', family: 'IPv4', internal: false },
      { address: 'fe80::1', netmask: 'ffff:ffff:ffff:ffff::', family: 'IPv6', internal: false },
    ],
    lo0: [{ address: '127.0.0.1', netmask: '255.0.0.0', family: 'IPv4', internal: true }],
  }, '   gateway: 192.168.1.1\n interface: en0\n');
  assert.equal(selected.interfaceName, 'en0');
  assert.equal(selected.address, '192.168.1.24');
  assert.equal(selected.netmask, '255.255.255.0');
  assert.throws(() => selectLanInterfaceAddress({}, 'interface: utun4\n'), /Could not safely select one private IPv4 address/);
  assert.throws(() => selectLanInterfaceAddress({ en0: [
    { address: '8.8.8.8', netmask: '255.255.255.0', family: 'IPv4', internal: false },
  ] }, 'interface: en0\n'), /Could not safely select one private IPv4 address/);
});

test('iPhone dev server serves only allowlisted runtime assets with explicit local-device metadata', async () => {
  await withServer(async (server) => {
    const shell = await request(server, '/');
    assert.equal(shell.status, 200);
    assert.match(shell.headers['cache-control'], /no-store/);
    assert.match(shell.body, /LOCAL DEV/);
    assert.match(shell.body, /\.local\/landos-world-build-metadata\.js\?v=local-device/);

    const metadata = await request(server, '/.local/landos-world-build-metadata.js');
    assert.equal(metadata.status, 200);
    assert.match(metadata.body, /environment":"local-device"/);
    assert.match(metadata.headers['cache-control'], /no-store/);

    const runtimeAsset = await request(server, '/css/lee-lee-diabetes.css');
    assert.equal(runtimeAsset.status, 200);
    assert.match(runtimeAsset.headers['cache-control'], /no-store/);
    assert.ok(runtimeAsset.body.length > 0);
  });
});

test('iPhone dev server denies repository, diagnostic, tooling, and traversal paths', async () => {
  await withServer(async (server) => {
    for (const path of [
      '/.git/config',
      '/.env',
      '/LLT_INSULIN_PLAN_RECONCILIATION_DRY_RUN_REPORT.md',
      '/tests/landos-world-dev-iphone.test.js',
      '/scripts/dev-iphone.mjs',
      '/package.json',
      '/%2e%2e/.env',
      '/js/%2e%2e/.env',
      '/js%2f..%2f.env',
    ]) {
      const response = await request(server, path);
      assert.equal(response.status, 404, `expected ${path} to be denied`);
      assert.doesNotMatch(response.body, /supabase|publishable|service_role|diagnostic/i);
    }
    assert.equal((await request(server, '/index.html', 'POST')).status, 405);
  });
});

test('iPhone dev network access is limited to the selected interface subnet', () => {
  assert.equal(isSameSubnetIPv4('192.168.1.90', '192.168.1.24', '255.255.255.0'), true);
  assert.equal(isSameSubnetIPv4('192.168.2.90', '192.168.1.24', '255.255.255.0'), false);
  assert.equal(isSameSubnetIPv4('::ffff:192.168.1.90', '192.168.1.24', '255.255.255.0'), true);
});


test('HTTPS explicit configuration and sensor activation fail closed', async () => {
  assert.equal(parseArgs([]).https, false);
  assert.equal(parseArgs([]).loopback, false);
  assert.equal(parseArgs(['--auth-preview', '--https', '--sensor-preview', '--loopback']).loopback, true);
  for (const args of [['--sensor-preview'], ['--auth-preview', '--sensor-preview'], ['--https', '--sensor-preview']]) {
    assert.throws(() => parseArgs(args), /requires/);
  }
  for (const options of [{ https: true }, { https: true, certPath: 'missing' }, { https: true, keyPath: 'missing' },
    { https: true, certPath: '/missing-cert', keyPath: '/missing-key' }, { certPath: 'unexpected' }]) {
    await assert.rejects(readPreviewTls(options), /requires|Unable|require/);
  }
  const options = { bindAddress: { address: '127.0.0.1', netmask: '255.0.0.0' }, getMetadata: () => ({ environment: 'local-auth-preview' }) };
  assert.throws(() => createIPhoneDevServer({ ...options, authOrigin: 'https://example.supabase.co', sensorPreview: true }), /requires/);
  assert.throws(() => createIPhoneDevServer({ ...options, tls: { cert: 'invalid', key: 'invalid' } }));
});

test('HTTPS handler exposes only explicit sensor metadata and narrow CSP; TLS material stays server-side', async (t) => {
  // Mock only TLS construction: no certificate generation, trust change or verification bypass.
  t.mock.method(https, 'createServer', (_tls, handler) => createServer(handler));
  for (const sensorPreview of [false, true]) {
    await withServer(async (server) => {
      const shell = await request(server, '/');
      assert.equal(shell.status, 200);
      assert.match(shell.body, /"previewHttps":true/);
      assert.match(shell.body, new RegExp(`"sensorPreview":${sensorPreview}`));
      assert.doesNotMatch(shell.body, /synthetic-private-material|synthetic-cert-material/);
      const csp = shell.headers['content-security-policy'];
      assert.equal(csp.includes('/rest/v1/rpc/llt_get_sensor_snapshot'), sensorPreview);
      assert.equal(csp.includes('/rest/v1/rpc/llt_mutate_sensor_cycle'), sensorPreview);
      assert.equal(csp.includes('wss://example.supabase.co/realtime/v1/websocket'), sensorPreview);
      assert.match(csp, /worker-src 'none'/);
      assert.doesNotMatch(csp, /connect-src \*/);
      for (const path of ['/.local/llt-auth-preview-tls/key.pem', '/.local/llt-auth-preview-tls/cert.pem']) assert.equal((await request(server, path)).status, 404);
    }, { authOrigin: 'https://example.supabase.co', tls: { cert: 'synthetic-cert-material', key: 'synthetic-private-material' }, sensorPreview,
      getMetadata: () => ({ environment: 'local-auth-preview', sensorPreview: !sensorPreview }) });
  }
  await withServer(async (server) => {
    const shell = await request(server, '/');
    assert.match(shell.body, /"sensorPreview":false/);
    assert.match(shell.body, /"previewHttps":false/);
  }, { authOrigin: 'https://example.supabase.co', getMetadata: () => ({ environment: 'local-auth-preview', sensorPreview: true, previewHttps: true }) });
});
