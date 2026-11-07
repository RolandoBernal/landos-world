import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const inlineScripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);

test('index.html has inline scripts to check', () => {
  assert.ok(inlineScripts.length > 0);
});

// A syntax error in any inline script block silently kills that whole block
// in the browser (the launcher once rendered zero apps this way) while unit
// tests that only regex-extract data from index.html stay green. Parse each
// block so the failure is caught here instead of on a device.
for (const [index, source] of inlineScripts.entries()) {
  test(`index.html inline script ${index} parses`, () => {
    assert.doesNotThrow(() => new vm.Script(source));
  });
}
