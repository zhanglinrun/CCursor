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

function snapshot(dir) {
  const files = readdirSync(dir, { recursive: true, withFileTypes: true });
  return new Map(files.filter(entry => entry.isFile()).map(entry => {
    const path = join(entry.parentPath, entry.name);
    return [path, readFileSync(path, 'utf-8')];
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
    const result = spawnSync(process.execPath, [cli, ...args], {
      cwd: temp,
      env: { ...process.env, CCURSOR_CURSOR_ROOT: root, HOME: home, USERPROFILE: home },
      encoding: 'utf8', timeout: 10000,
    });
    assert.equal(result.error, undefined);
    return { status: result.status, output: result.stdout + result.stderr };
  }
  return { root, home, readApp, writeApp, run };
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
