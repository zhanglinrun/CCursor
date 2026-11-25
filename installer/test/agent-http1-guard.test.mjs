import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {
  guardAgentHttp1,
  hasHttp1GuardAnchor,
  HTTP1_GUARD_MARKER,
  HTTP1_REBUILD_MARKER,
  isHttp1GuardPatched,
} from '../src/agent-http1-guard.js';

const SAMPLE_BUNDLE = `
class Platform {
  constructor(fallback, cfg) {
    this.httpProtocolFallback = fallback;
    this._cfg = cfg;
  }
  isHttp2Disabled(){return this.httpProtocolFallback.isDisabled("http2")||this.isHttp2DisabledByConfiguration()}
  isHttp2DisabledByConfiguration(){return this._cfg}
}
class TransportHandler {
  constructor(host) {
    this.host = host;
    this.disposables = [];
    this.cursorCreds = { backendUrl: "https://api2.cursor.sh" };
    this.rebuilds = [];
  }
  async setup(reason) { this.rebuilds.push(reason); }
  setupEventListeners() {
    this.disposables.push(this.host.onDidChangeHttpProtocolSettings((()=>{this.setup("protocol_settings").catch(()=>{})})));
  }
  dispose() { this.disposables.forEach(d => d.dispose()); }
}
globalThis.Platform = Platform;
globalThis.TransportHandler = TransportHandler;
`;

test('guardAgentHttp1 forces HTTP/1.1 only while BYOK routes RunSSE and triggers live rebuild on toggle', async () => {
  assert.equal(hasHttp1GuardAnchor(SAMPLE_BUNDLE), true);
  assert.equal(isHttp1GuardPatched(SAMPLE_BUNDLE), false);

  const first = guardAgentHttp1(SAMPLE_BUNDLE);
  assert.equal(first.changed, true);
  assert.ok(first.source.includes(HTTP1_GUARD_MARKER));
  assert.ok(first.source.includes(HTTP1_REBUILD_MARKER));
  assert.equal(isHttp1GuardPatched(first.source), true);

  // Idempotent on second application.
  const second = guardAgentHttp1(first.source);
  assert.equal(second.changed, false);
  assert.equal(second.source, first.source);

  let byokOn = true;
  const listeners = new Set();
  const sandbox = {
    __byokRpcRouted: path => byokOn && path === '/agent.v1.AgentService/RunSSE',
    __byokOnRouteChange: fn => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(first.source, sandbox);

  const platform = new sandbox.Platform({ isDisabled: () => false }, false);
  assert.equal(platform.isHttp2Disabled(), true, 'BYOK ON must force HTTP/1.1 even when user did not disable HTTP/2');

  byokOn = false;
  assert.equal(platform.isHttp2Disabled(), false, 'BYOK OFF must preserve native Cursor HTTP/2');

  const platformUserDisabled = new sandbox.Platform({ isDisabled: () => false }, true);
  assert.equal(platformUserDisabled.isHttp2Disabled(), true, 'BYOK OFF still respects user disableHttp2 setting');

  const handler = new sandbox.TransportHandler({
    onDidChangeHttpProtocolSettings: () => ({ dispose() {} }),
  });
  handler.setupEventListeners();
  assert.equal(listeners.size, 1);

  for (const fn of listeners) fn(true);
  await Promise.resolve();
  assert.deepEqual([...handler.rebuilds], ['protocol_settings']);

  handler.dispose();
  assert.equal(listeners.size, 0, 'dispose must unsubscribe route change listener');
});

test('guardAgentHttp1 leaves bundles without anchor untouched', () => {
  const plain = 'function activate() { return 1; }';
  assert.equal(hasHttp1GuardAnchor(plain), false);
  assert.equal(isHttp1GuardPatched(plain), true);
  const res = guardAgentHttp1(plain);
  assert.equal(res.changed, false);
  assert.equal(res.source, plain);
});

test('guardAgentHttp1 handles single quotes and whitespace around both anchors', () => {
  const source = SAMPLE_BUNDLE
    .replace('isHttp2Disabled(){return', 'isHttp2Disabled (\n ) {\n  return ')
    .replace('isDisabled("http2")', "isDisabled (\n 'http2' )")
    .replace('push(this.host.onDidChangeHttpProtocolSettings(', 'push (\n this.host.onDidChangeHttpProtocolSettings (');
  assert.equal(hasHttp1GuardAnchor(source), true);
  assert.equal(isHttp1GuardPatched(source), false);
  const result = guardAgentHttp1(source);
  assert.ok(result.source.includes(HTTP1_GUARD_MARKER));
  assert.ok(result.source.includes(HTTP1_REBUILD_MARKER));
  assert.equal(isHttp1GuardPatched(result.source), true);
  assert.doesNotThrow(() => new vm.Script(result.source));
});

test('guardAgentHttp1 completes a partial guard that is missing its rebuild hook', () => {
  const partial = SAMPLE_BUNDLE.replace('isHttp2Disabled(){return', `isHttp2Disabled(){${HTTP1_GUARD_MARKER}if(globalThis.__byokRpcRouted?.('/agent.v1.AgentService/RunSSE'))return true;return`);
  assert.equal(hasHttp1GuardAnchor(partial), false);
  assert.equal(isHttp1GuardPatched(partial), false);

  const result = guardAgentHttp1(partial);
  assert.equal(result.changed, true);
  assert.equal(result.source.split(HTTP1_GUARD_MARKER).length, 2);
  assert.ok(result.source.includes(HTTP1_REBUILD_MARKER));
  assert.equal(isHttp1GuardPatched(result.source), true);
  assert.equal(guardAgentHttp1(result.source).changed, false);
});
