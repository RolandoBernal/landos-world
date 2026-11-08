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

// Every settings toggle in index.html draws the same gear icon. One copy
// once shipped with three corrupted path tokens (a flipped arc sweep flag
// and two flipped signs), which carved a visible notch into the LLT cog.
// Keep every copy token-identical so a transcription slip fails here.
test('every gear icon path in index.html is token-identical', () => {
  const paths = [...html.matchAll(/M12\.22 2h-\.44[^"]+/g)].map((match) => match[0]);
  assert.ok(paths.length > 1);
  const tokenize = (d) => d.match(/[A-Za-z]|-?\d*\.?\d+/g);
  const canonical = tokenize(paths[0]);
  for (const d of paths) assert.deepEqual(tokenize(d), canonical);
});
