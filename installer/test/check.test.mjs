import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'ccursor-check-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}
function check(root) {
  return spawnSync(process.execPath, ['--input-type=module', '-e', 'const { check } = await import(process.argv[1]); await check();', new URL('../src/check.js', import.meta.url).href], {
    env: { ...process.env, CCURSOR_CURSOR_ROOT: root }, encoding: 'utf8', timeout: 10000,
  });
}

test('missing installation reports a failing exit code', (t) => {
  const result = check(fixture(t));
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /Cursor installation not found/);
});

test('preflight reports an unsupported glass refresh without modifying the bundle', (t) => {
  const root = fixture(t);
  writeFileSync(join(root, 'product.json'), '{}');
  writeFileSync(join(root, 'package.json'), '{"version":"3.15.19"}');
  const workbench = join(root, 'out', 'vs', 'workbench');
  mkdirSync(workbench, { recursive: true });
  const source = '// callback-client.js\nclass Service {}';
  writeFileSync(join(workbench, 'workbench.desktop.main.js'), source);
  const glass = join(workbench, 'workbench.glass.main.js');
  writeFileSync(glass, source);
  const result = check(root);
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /Glass model refresh:.*matched 0 times/);
  assert.equal(readFileSync(glass, 'utf8'), source);
});
