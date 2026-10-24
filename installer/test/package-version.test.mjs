import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { writePackageVersion } from '../../scripts/package-version.mjs';

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'ccursor-version-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, 'package.json'), '{\n  "name": "fixture",\n  "version": "0.0.26"\n}\n');
  return dir;
}

test('version bump keeps manifest and npm lock roots aligned without changing dependencies', (t) => {
  const dir = fixture(t);
  const lock = { name: 'fixture', version: '0.0.26', lockfileVersion: 3, packages: { '': { version: '0.0.26' }, 'node_modules/acorn': { version: '8.16.0' } } };
  writeFileSync(join(dir, 'package-lock.json'), JSON.stringify(lock));
  writePackageVersion(dir, '0.1.0');
  assert.equal(JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version, '0.1.0');
  const updated = JSON.parse(readFileSync(join(dir, 'package-lock.json'), 'utf8'));
  assert.equal(updated.version, '0.1.0');
  assert.equal(updated.packages[''].version, '0.1.0');
  assert.deepEqual(updated.packages['node_modules/acorn'], lock.packages['node_modules/acorn']);
});

test('pnpm-only package can be bumped without an npm lockfile', (t) => {
  const dir = fixture(t);
  writePackageVersion(dir, '0.1.0');
  writePackageVersion(dir, '0.1.0');
  assert.equal(JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version, '0.1.0');
});

test('invalid lockfile fails before changing the package version', (t) => {
  const dir = fixture(t);
  writeFileSync(join(dir, 'package-lock.json'), '{}');
  assert.throws(() => writePackageVersion(dir, '0.1.0'), /Missing root package/);
  assert.equal(JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version, '0.0.26');
});
