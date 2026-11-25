import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';

const desktop = 'out/vs/workbench/workbench.desktop.main.js';
const glass = 'out/vs/workbench/workbench.glass.main.js';
const html = 'out/vs/code/electron-sandbox/workbench/workbench.html';
const extensionHost = 'out/vs/workbench/api/node/extensionHostProcess.js';
const legacy = 'extensions/cursor-always-local/dist/main.js';
const agentHost = 'extensions/cursor-agent-host/dist/main.js';
const singleton = 'out/vs/code/electron-utility/alwaysLocalSingleton/alwaysLocalSingletonMain.js';
const rendererSource = `
const bundle = "callback-client.js";
function dispatch(s,t){switch(s.kind){case Kind.Unary:return t.unary;case Kind.ServerStreaming:return t.stream;case Kind.BiDiStreaming:return t.stream}}
function connect(s,t){return dispatch(s,t)}
class Topology{constructor(a,b){this._agentHostEnabled=a||b}}
class Models{async refreshDefaultModels(){this.trySeedCatalogFromOwnKey();if(!this._cursorAuthenticationService.isAuthenticated())return;}}
const builtInOnly=["vscode.github-authentication"],allowed=["anysphere.remote-wsl"];
`;
const activate = 'exports.activate=function(ctx){return ctx};exports.deactivate=function(){};';
const singletonSource = `
import{createRequire as makeRequire}from"node:module";
import * as ht from "http";import * as hs from "https";
function setup(log,x){installProxy(x),syncBuiltin(),log.info("[AlwaysLocalSingleton] proxy-agent patches installed")}
`;
const hostSource = 'async function verify(pkg){if (!(await signedByPublisher(pkg))) throw Error("Bad signature");}\n';

const hash = source => createHash('sha256').update(source).digest('base64').replace(/=+$/, '');

function snapshot(dir, encoding = 'utf-8') {
  const files = readdirSync(dir, { recursive: true, withFileTypes: true });
  return new Map(files.filter(entry => entry.isFile()).map(entry => {
    const path = join(entry.parentPath, entry.name);
    return [path, readFileSync(path, encoding)];
  }));
}

function fixture(t) {
  const temp = mkdtempSync(join(tmpdir(), 'ccursor-inject-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const root = join(temp, 'app');
  const home = join(temp, 'home');
  const cli = join(temp, 'cli.cjs');
  buildSync({
    entryPoints: [fileURLToPath(new URL('../src/cli.js', import.meta.url))],
    bundle: true, platform: 'node', format: 'cjs', outfile: cli,
  });

  function write(base, file, content) {
    const path = join(base, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  const writeApp = (file, content) => write(root, file, content);
  const readApp = file => readFileSync(join(root, file), 'utf-8');
  for (const file of [desktop, glass]) writeApp(file, rendererSource);
  writeApp('package.json', '{"version":"3.23.12"}');
  writeApp(extensionHost, hostSource);
  writeApp(html, '<html><head></head></html>');
  writeApp(legacy, activate);
  writeApp(agentHost, activate + `
const entry=['cursorAgentHostEnabled','registerAgentHostProvider','Activating agent host extension'];
const network=['agent.v1.AgentService','RunSSE','BidiAppend','AiConnectTransportHandler','HTTP/1.1 transport created with network settings'];
const router='@anysphere/agent-host:local-loop-turn-router';
function turn(){return {runtime:"managed-local",reason:"eligible"}}
`);
  writeApp('extensions/cursor-agent-host/package.json', '{"name":"cursor-agent-host","publisher":"anysphere","main":"./dist/main.js"}');
  writeApp(singleton, singletonSource);
  const checksums = Object.fromEntries([desktop, glass, singleton, extensionHost, html].map(file =>
    [file.slice('out/'.length), hash(readApp(file))]));
  writeApp('product.json', JSON.stringify({ checksums, extensionAllowed: 'original' }));
  write(home, '.ccursor/routes.json', '{"server":{"host":"127.0.0.1","port":8765}}');
  write(home, '.ccursor/providers.json', '{"custom":true}');
  write(home, '.cursor/extensions/cursor2plus/package.json', '{"name":"cursor2plus"}');

  function run(...args) {
    return runWithNodeArgs([], ...args);
  }
  function runWithNodeArgs(nodeArgs, ...args) {
    const result = spawnSync(process.execPath, [...nodeArgs, cli, ...args], {
      cwd: temp,
      env: { ...process.env, CCURSOR_CURSOR_ROOT: root, HOME: home, USERPROFILE: home },
      encoding: 'utf8', timeout: 10000,
    });
    assert.equal(result.error, undefined);
    return { status: result.status, output: result.stdout + result.stderr };
  }
  return { root, home, readApp, writeApp, run, runWithNodeArgs };
}

test('routing preflight accepts an unknown signature check and inject changes only routing files', (t) => {
  const { root, home, readApp, run } = fixture(t);
  const appBefore = snapshot(root);
  const homeBefore = snapshot(home);

  const preflight = run('check', '--routing-only');
  assert.equal(preflight.status, 0, preflight.output);
  assert.match(preflight.output, /Routing preflight passed/);
  assert.deepEqual(snapshot(root), appBefore);
  assert.deepEqual(snapshot(home), homeBefore);

  const legacyCheck = run('check');
  assert.equal(legacyCheck.status, 1, legacyCheck.output);
  assert.match(legacyCheck.output, /Sig bypass pattern not found/);
  assert.deepEqual(snapshot(root), appBefore);

  const applied = run('inject');
  assert.equal(applied.status, 0, applied.output);
  assert.match(applied.output, /Routing patches applied to 6 file\(s\)/);
  for (const file of [desktop, glass]) {
    const source = readApp(file);
    assert.match(source, /globalThis\.__byokWrapTransport\(t,s\.typeName\)/);
    assert.match(source, /http:\/\/127\.0\.0\.1:8765/);
    assert.match(source, /this\._agentHostEnabled=false\/\*BYOK-AGENT-HOST-GATE-OFF\*\//);
    assert.match(source, /if\(!this\._cursorAuthenticationService\.isAuthenticated\(\)\)return/);
    assert.match(source, /builtInOnly=\["vscode\.github-authentication"\],allowed=\["anysphere\.remote-wsl"\]/);
    assert.doesNotMatch(source, /__byokForceRefresh|cometix-space\.cursor2plus/);
  }
  assert.match(readApp(legacy), /__byokUrlRewrite/);
  assert.match(readApp(agentHost), /__byokAgentHostUrlRewrite/);
  assert.match(readApp(agentHost), /byok-connect-routed/);
  assert.match(readApp(singleton), /__byokSingletonUrlRewrite/);
  assert.equal(readApp(extensionHost), hostSource);
  assert.equal(readApp(html), appBefore.get(join(root, html)));
  assert.ok(!existsSync(join(root, 'extensions/cursor2plus')));
  assert.deepEqual(snapshot(home), homeBefore);

  const appliedProduct = JSON.parse(readApp('product.json'));
  assert.equal(appliedProduct.extensionAllowed, 'original');
  for (const file of [desktop, glass, singleton, extensionHost, html]) {
    assert.equal(appliedProduct.checksums[file.slice('out/'.length)], hash(readApp(file)));
  }
  const appAfter = snapshot(root);
  assert.ok(![...appAfter.keys()].some(path => path.includes('extensionHostProcess.js.backup')));
  const rerun = run('inject');
  assert.equal(rerun.status, 0, rerun.output);
  assert.match(rerun.output, /Routing patches are current/);
  assert.deepEqual(snapshot(root), appAfter);
  assert.deepEqual(snapshot(home), homeBefore);

  const removed = run('uninstall');
  assert.equal(removed.status, 0, removed.output);
  assert.deepEqual(snapshot(root), appBefore);
  assert.deepEqual(snapshot(home), homeBefore);
});

test('a late routing incompatibility or stale backup leaves the application untouched', (t) => {
  const { root, home, writeApp, run } = fixture(t);
  writeApp(singleton, 'const unsupported = true;');
  const unsupported = snapshot(root);
  const homeBefore = snapshot(home);
  for (const args of [['check', '--routing-only'], ['inject']]) {
    const result = run(...args);
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /Unsupported singleton HTTP\/1\.1 transport/);
    assert.deepEqual(snapshot(root), unsupported);
  }

  writeApp(singleton, singletonSource);
  writeApp(`${desktop}.backup-byok-inject-2020-01-01T00-00-00`, '// Prior Cursor bundle');
  const stale = snapshot(root);
  for (const args of [['check', '--routing-only'], ['inject']]) {
    const result = run(...args);
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /Existing backup .* prevents safe application/);
    assert.deepEqual(snapshot(root), stale);
  }
  assert.deepEqual(snapshot(home), homeBefore);
});

test('syncs built-in extension verification hash map regardless of minified var name and restores cleanly on uninstall', (t) => {
  const { root, readApp, writeApp, run } = fixture(t);
  const sha256 = content => createHash('sha256').update(content).digest('hex');
  const legacyOrigHash = sha256(readApp(legacy));
  const siblingOrigHash = 'a'.repeat(64);
  const hostWithS3Map = [
    'function check(i){if(i&&i in s3){const o=s3[i];if(o){this._logService.trace(`ExtensionService#loadModule checking expected hashes for ${i}`);return o}}}',
    `var s3={"anysphere.cursor-always-local":{dist:{"254.js":"${'b'.repeat(64)}","main.js":"${legacyOrigHash}"}},"anysphere.cursor-other":{dist:{"main.js":"${siblingOrigHash}"}}};`,
    'const msg=`Hash mismatch for files: ${m}`;',
  ].join('\n');
  writeApp(extensionHost, hostWithS3Map);
  const product = JSON.parse(readApp('product.json'));
  // Exercise uninstall with no renderer checksum backup to mask a wrong restore order.
  delete product.checksums[desktop.slice('out/'.length)];
  delete product.checksums[glass.slice('out/'.length)];
  product.checksums[extensionHost.slice('out/'.length)] = hash(hostWithS3Map);
  writeApp('product.json', JSON.stringify(product));
  const appBefore = snapshot(root);

  const preflight = run('check', '--routing-only');
  assert.equal(preflight.status, 0, preflight.output);
  assert.match(preflight.output, /Routing preflight passed/);

  const applied = run('inject');
  assert.equal(applied.status, 0, applied.output);
  const patchedLegacyHash = sha256(readApp(legacy));
  assert.notEqual(patchedLegacyHash, legacyOrigHash);
  const patchedHost = readApp(extensionHost);
  assert.ok(patchedHost.includes(`"main.js":"${patchedLegacyHash}"`), 'cursor-always-local hash synced in s3');
  assert.ok(patchedHost.includes(`"anysphere.cursor-other":{dist:{"main.js":"${siblingOrigHash}"}}`), 'sibling extension hash untouched');
  const appliedProduct = JSON.parse(readApp('product.json'));
  assert.equal(appliedProduct.checksums[extensionHost.slice('out/'.length)], hash(patchedHost));

  const rerun = run('inject');
  assert.equal(rerun.status, 0, rerun.output);
  assert.match(rerun.output, /Routing patches are current/);

  const removed = run('uninstall');
  assert.equal(removed.status, 0, removed.output);
  assert.deepEqual(snapshot(root), appBefore);
});

test('fails loudly when extensionHostProcess enforces hashes but verification map cannot be located', (t) => {
  const { root, readApp, writeApp, run } = fixture(t);
  const hostBroken = 'function verify(i){this._logService.trace(`ExtensionService#loadModule checking expected hashes for ${i}`);return{valid:!1,error:`Hash mismatch for files: ${i}`}}';
  writeApp(extensionHost, hostBroken);
  const product = JSON.parse(readApp('product.json'));
  product.checksums[extensionHost.slice('out/'.length)] = hash(hostBroken);
  writeApp('product.json', JSON.stringify(product));
  const before = snapshot(root);

  for (const args of [['check', '--routing-only'], ['inject']]) {
    const res = run(...args);
    assert.equal(res.status, 1, res.output);
    assert.match(res.output, /verification hash map not found/i);
    assert.deepEqual(snapshot(root), before);
  }
  const status = run('status');
  assert.equal(status.status, 0, status.output);
  assert.match(status.output, /Built-in extension hash table unreadable \(verification hash map not found\)/);
});

test('in-place upgrades a pre-patched Cursor 3.31 tree (_topologyEnabled + stale s3 hash)', (t) => {
  const { root, readApp, writeApp, run } = fixture(t);
  const sha256 = content => createHash('sha256').update(content).digest('hex');
  const renderer331 = rendererSource.replace('this._agentHostEnabled=a||b', 'this._isGlass=!1,this._topologyEnabled=a&&!b||c,this._logService.info("x")');
  for (const file of [desktop, glass]) writeApp(file, renderer331);
  const legacyOrigHash = sha256(readApp(legacy));
  const hostWithS3Map = `function c(i){if(i&&i in s3){const o=s3[i];this._logService.trace(\`ExtensionService#loadModule checking expected hashes for \${i}\`);}}var s3={"anysphere.cursor-always-local":{dist:{"main.js":"${legacyOrigHash}"}}};`;
  writeApp(extensionHost, hostWithS3Map);
  const product = JSON.parse(readApp('product.json'));
  for (const file of [desktop, glass, extensionHost]) {
    product.checksums[file.slice('out/'.length)] = hash(readApp(file));
  }
  writeApp('product.json', JSON.stringify(product));

  // First inject simulates a clean 3.31 install
  const first = run('inject');
  assert.equal(first.status, 0, first.output);
  for (const file of [desktop, glass]) {
    assert.match(readApp(file), /this\._topologyEnabled=false\/\*BYOK-AGENT-HOST-GATE-OFF\*\//);
  }
  const patchedLegacyHash = sha256(readApp(legacy));
  assert.ok(readApp(extensionHost).includes(patchedLegacyHash));

  // Simulate an older v0.1.9 injection where _topologyEnabled & s3 were missed while backups exist
  for (const file of [desktop, glass]) {
    writeApp(file, readApp(file).replace('this._topologyEnabled=false/*BYOK-AGENT-HOST-GATE-OFF*/', 'this._topologyEnabled=a&&!b||c'));
  }
  writeApp(extensionHost, hostWithS3Map);
  const prod2 = JSON.parse(readApp('product.json'));
  for (const file of [desktop, glass, extensionHost]) {
    prod2.checksums[file.slice('out/'.length)] = hash(readApp(file));
  }
  writeApp('product.json', JSON.stringify(prod2));

  // Re-inject must upgrade in-place cleanly without rejecting existing backups or rev3 hook
  const upgraded = run('inject');
  assert.equal(upgraded.status, 0, upgraded.output);
  for (const file of [desktop, glass]) {
    assert.match(readApp(file), /this\._topologyEnabled=false\/\*BYOK-AGENT-HOST-GATE-OFF\*\//);
  }
  assert.ok(readApp(extensionHost).includes(patchedLegacyHash));
});

test('a failed incremental write restores pre-run files and preserves existing uninstall backups', (t) => {
  const { root, home, readApp, writeApp, run, runWithNodeArgs } = fixture(t);
  const originalHash = createHash('sha256').update(readApp(legacy)).digest('hex');
  const first = run('inject');
  assert.equal(first.status, 0, first.output);

  writeApp(extensionHost, `const map={'cursor-always-local':{dist:{'main.js':'${originalHash}'}}};`);
  for (const file of [desktop, glass]) {
    writeApp(file, readApp(file).replace('false/*BYOK-AGENT-HOST-GATE-OFF*/', 'a||b'));
  }
  const product = JSON.parse(readApp('product.json'));
  for (const file of [desktop, glass, extensionHost]) {
    product.checksums[file.slice('out/'.length)] = hash(readApp(file));
  }
  writeApp('product.json', JSON.stringify(product));

  const appBefore = snapshot(root, null);
  const preflight = run('check', '--routing-only');
  assert.equal(preflight.status, 0, preflight.output);
  assert.match(preflight.output, /4 file\(s\) would change/);
  assert.deepEqual(snapshot(root, null), appBefore);

  const preload = join(home, 'fail-write.cjs');
  writeFileSync(preload, `
    const fs = require('node:fs');
    const write = fs.writeFileSync;
    const failedFile = ${JSON.stringify(join(root, glass))};
    let failed = false;
    fs.writeFileSync = (file, source, ...options) => {
      if (file === failedFile && !failed) {
        failed = true;
        write(file, source.slice(0, 50), ...options);
        throw new Error('fixture write failed after truncating glass');
      }
      return write(file, source, ...options);
    };
    require('node:module').syncBuiltinESMExports();
  `);
  const failed = runWithNodeArgs(['--require', preload], 'inject');
  assert.equal(failed.status, 1, failed.output);
  assert.match(failed.output, /Applying routing patches failed.*fixture write failed after truncating glass/);
  assert.doesNotMatch(failed.output, /Rollback failed/);
  assert.deepEqual(snapshot(root, null), appBefore);

  const retry = run('inject');
  assert.equal(retry.status, 0, retry.output);
  assert.match(retry.output, /Routing patches applied to 4 file\(s\)/);
  for (const [file, source] of appBefore) {
    if (file.includes('.backup-byok-')) assert.deepEqual(readFileSync(file), source);
  }
});

test('ignores a nearer shadowed variable of the same name and updates the real verification hash table', (t) => {
  const { root, readApp, writeApp, run } = fixture(t);
  const sha256 = content => createHash('sha256').update(content).digest('hex');
  const legacyOrigHash = sha256(readApp(legacy));
  const shadowedHost = [
    `var s3={"anysphere.cursor-always-local":{dist:{"main.js":"${legacyOrigHash}"}}};`,
    `function unrelated(){var s3={"other.ext":{dist:{"x.js":"${'c'.repeat(64)}"}}};return s3;}`,
    'function check(i){if(i&&i in s3){const o=s3[i];this._logService.trace(`ExtensionService#loadModule checking expected hashes for ${i}`);return o}}',
    'const err=`Hash mismatch for files: ${m}`;',
  ].join('\n');
  writeApp(extensionHost, shadowedHost);
  const product = JSON.parse(readApp('product.json'));
  product.checksums[extensionHost.slice('out/'.length)] = hash(shadowedHost);
  writeApp('product.json', JSON.stringify(product));
  const appBefore = snapshot(root);

  const applied = run('inject');
  assert.equal(applied.status, 0, applied.output);
  const patchedLegacyHash = sha256(readApp(legacy));
  assert.ok(readApp(extensionHost).includes(`"anysphere.cursor-always-local":{dist:{"main.js":"${patchedLegacyHash}"}}`));

  const removed = run('uninstall');
  assert.equal(removed.status, 0, removed.output);
  assert.deepEqual(snapshot(root), appBefore);
});

test('legacy always-local backup on extensionHostProcess.js followed by inject restores clean original on uninstall', (t) => {
  const { root, readApp, writeApp, run } = fixture(t);
  const sha256 = content => createHash('sha256').update(content).digest('hex');
  const legacyOrigHash = sha256(readApp(legacy));
  const stockHost = `function check(i){if(i&&i in s3){const o=s3[i];this._logService.trace(\`ExtensionService#loadModule checking expected hashes for \${i}\`);return o}}var s3={"anysphere.cursor-always-local":{dist:{"main.js":"${legacyOrigHash}"}}};if(!r.valid)throw Error("sig");`;
  const sigBypassedHost = stockHost.replace('if(!r.valid)', 'if(!1)');

  // Simulate legacy install having already patched extensionHostProcess.js under always-local tag
  writeApp(extensionHost, stockHost);
  const prod = JSON.parse(readApp('product.json'));
  prod.checksums[extensionHost.slice('out/'.length)] = hash(stockHost);
  writeApp('product.json', JSON.stringify(prod));

  const first = run('inject');
  assert.equal(first.status, 0, first.output);

  // Now simulate legacy sig-bypass + always-local backup holding stockHost, while disk has sigBypassedHost with old hash
  writeApp(extensionHost, sigBypassedHost);
  const prod2 = JSON.parse(readApp('product.json'));
  prod2.checksums[extensionHost.slice('out/'.length)] = hash(sigBypassedHost);
  writeApp('product.json', JSON.stringify(prod2));

  const upgraded = run('inject');
  assert.equal(upgraded.status, 0, upgraded.output);
  const patchedLegacyHash = sha256(readApp(legacy));
  assert.ok(readApp(extensionHost).includes(patchedLegacyHash));

  const removed = run('uninstall');
  assert.equal(removed.status, 0, removed.output);
  assert.equal(readApp(extensionHost), stockHost, 'uninstall must restore the original stock extensionHostProcess.js');
});
