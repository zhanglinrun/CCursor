import assert from 'node:assert/strict';
import test from 'node:test';
import * as acorn from 'acorn';
import { forceConnectTurnRoute, TURN_ROUTER_FINGERPRINT } from '../src/patch-agent-host.js';

for (const route of [
  '{runtime:"managed-local",reason:"eligible"}',
  "{ reason : 'eligible', runtime : 'managed-local', disposition: 'primary' }",
]) {
  test(`eligible turn uses connect: ${route}`, () => {
    const source = `const log=${JSON.stringify(TURN_ROUTER_FINGERPRINT)};function route(){return ${route}}`;
    const result = forceConnectTurnRoute(source);
    assert.equal(result.required, true);
    assert.equal(result.changed, true);
    acorn.parse(result.source, { ecmaVersion: 'latest' });
    const actualRoute = new Function(`${result.source}; return route();`)();
    assert.equal(actualRoute.runtime, 'connect');
    assert.equal(actualRoute.reason, 'byok-connect-routed');
    const repeated = forceConnectTurnRoute(result.source);
    assert.equal(repeated.changed, false);
    assert.equal(repeated.matched, true);
  });
}

test('private inference remains unchanged and unmatched shapes are reported', () => {
  const source = `const log=${JSON.stringify(TURN_ROUTER_FINGERPRINT)};const route={runtime:"managed-local",reason:"private-inference-eligible"};`;
  const result = forceConnectTurnRoute(source);
  assert.equal(result.source, source);
  assert.equal(result.required, true);
  assert.equal(result.matched, false);
});

test('older bundles without the routing fingerprint are unchanged', () => {
  const source = 'const route={runtime:"managed-local",reason:"eligible"};';
  const result = forceConnectTurnRoute(source);
  assert.equal(result.required, false);
  assert.equal(result.source, source);
});
