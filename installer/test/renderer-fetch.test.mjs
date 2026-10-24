import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { buildHookPayload } from '../src/patch-inject.js';
import { DEFAULT_ROUTES } from '../src/defaults.js';

function hook() {
  const calls = [];
  const context = vm.createContext({
    Request, Response, Headers, URL,
    window: { vscodeWindowId: 7 },
    document: { body: null, querySelector: () => null },
    EventSource: class { addEventListener() {} },
    setTimeout: () => 0,
    console: { log() {}, warn() {} },
    fetch: async (...args) => {
      calls.push(args);
      return new Response(null, { status: 200 });
    },
  });
  vm.runInContext(buildHookPayload(false, DEFAULT_ROUTES), context);
  return { context, calls };
}

test('redirected Request applies init method, body, headers and cancellation overrides', async () => {
  const { context, calls } = hook();
  const request = new Request('https://api2.cursor.sh/auth/stripe_profile', { headers: { 'x-original': 'old' } });
  const controller = new AbortController();
  await context.fetch(request, { method: 'POST', body: 'override body', headers: { 'x-new': 'new' }, signal: controller.signal });
  const redirected = calls.find(([url]) => typeof url === 'string' && url.endsWith('/auth/stripe_profile'));
  assert.ok(redirected);
  const [url, init] = redirected;
  assert.equal(new URL(url).hostname, '127.0.0.1');
  assert.equal(init.method, 'POST');
  assert.equal(await new Response(init.body).text(), 'override body');
  assert.equal(new Headers(init.headers).get('x-new'), 'new');
  assert.equal(new Headers(init.headers).get('x-original'), null);
  assert.equal(new Headers(init.headers).get('x-client-wid'), '7');
  controller.abort();
  assert.equal(init.signal.aborted, true);
});

test('redirected Request without init retains its method and body', async () => {
  const { context, calls } = hook();
  await context.fetch(new Request('https://api2.cursor.sh/auth/stripe_profile', { method: 'POST', body: 'original body' }));
  const [, init] = calls.find(([url]) => typeof url === 'string' && url.endsWith('/auth/stripe_profile'));
  assert.equal(init.method, 'POST');
  assert.equal(await new Response(init.body).text(), 'original body');
});

test('requests outside the redirect list retain their original fetch arguments', async () => {
  const { context, calls } = hook();
  const request = new Request('https://example.net/untouched');
  const init = { headers: { 'x-override': 'keep' } };
  await context.fetch(request, init);
  const forwarded = calls.find(([url]) => url === request);
  assert.ok(forwarded);
  assert.equal(forwarded[1], init);
});
