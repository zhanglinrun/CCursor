import assert from 'node:assert/strict';
import test from 'node:test';
import * as acorn from 'acorn';
import {
  assertTurnRouteShape,
  guardTurnRoute,
  hasTurnRouter,
  isTurnRouteGuarded,
  mayContainTurnRoute,
  TURN_ROUTE_MARKER,
} from '../src/agent-turn-route-guard.js';

const FINGERPRINT = '@anysphere/agent-host:local-loop-turn-router';
const GUARD_TEST = 'globalThis.__byokRpcRouted&&globalThis.__byokRpcRouted("/agent.v1.AgentService/RunSSE")';

for (const route of [
  '{runtime:"managed-local",reason:"eligible"}',
  '{ reason: "eligible", runtime: "managed-local" }',
]) {
  test(`eligible turn is wrapped in a conditional guard: ${route}`, () => {
    const source = `const log=${JSON.stringify(FINGERPRINT)};function route(){return ${route}}`;
    assert.equal(hasTurnRouter(source), true);
    const result = guardTurnRoute(source, 'test.js');
    assert.equal(result.changed, 1);
    acorn.parse(result.source, { ecmaVersion: 'latest' });
    // 未接管 (BYOK OFF): globalThis.__byokRpcRouted 未定义 → 原分支
    const actualRoute = new Function(`${result.source}; return route();`)();
    assert.equal(actualRoute.runtime, 'managed-local');
    assert.equal(actualRoute.reason, 'eligible');
    // BYOK 接管 RunSSE → connect 分支
    globalThis.__byokRpcRouted = () => true;
    try {
      const pinned = new Function(`${result.source}; return route();`)();
      assert.equal(pinned.runtime, 'connect');
      assert.equal(pinned.reason, 'byok-connect-routed');
    }
    finally {
      delete globalThis.__byokRpcRouted;
    }
    assert.ok(result.source.includes(TURN_ROUTE_MARKER));
    assert.equal(isTurnRouteGuarded(result.source), true);
    const repeated = guardTurnRoute(result.source, 'test.js');
    assert.equal(repeated.changed, 0);
  });
}

test('routes with extra properties are left untouched (shape change => fail closed)', () => {
  const source = `const log=${JSON.stringify(FINGERPRINT)};const route={runtime:"managed-local",reason:"eligible",disposition:"primary"};`;
  assert.equal(mayContainTurnRoute(source), true);
  assert.throws(() => assertTurnRouteShape([{ file: 'main.js', source }]), /not found/);
});

test('private inference route is never touched', () => {
  const source = `const log=${JSON.stringify(FINGERPRINT)};const route={runtime:"managed-local",reason:"private-inference-eligible"};`;
  const result = guardTurnRoute(source, 'test.js');
  assert.equal(result.source, source);
  assert.equal(result.changed, 0);
  assert.equal(isTurnRouteGuarded(source), true);
});

test('bundles without the routing fingerprint do not require the guard', () => {
  const source = 'const route={runtime:"managed-local",reason:"eligible"};';
  assert.equal(hasTurnRouter(source), false);
  assert.deepEqual(assertTurnRouteShape([{ file: 'main.js', source }]), { required: false });
});

test('chunks without a logger name can still be guarded via content', () => {
  const source = `const chunkRoute={runtime:"managed-local",reason:"eligible"};`;
  assert.equal(mayContainTurnRoute(source), true);
  const result = guardTurnRoute(source, '61.js');
  assert.equal(result.changed, 1);
  assert.equal(isTurnRouteGuarded(result.source, '61.js'), true);
});

test('quote style variations are located by AST, not literals', () => {
  const source = `const log=${JSON.stringify(FINGERPRINT)};const changed={"runtime":"managed-local","reason":"eligible"};`;
  const result = guardTurnRoute(source, 'test.js');
  assert.equal(result.changed, 1);
  assert.ok(result.source.includes(GUARD_TEST));
  // 守卫是条件包裹 (三元), 原字面量仍在 else 分支 —— 验证的是 test 侧引用了路由判定
  assert.ok(result.source.includes(`${GUARD_TEST}?{runtime:"connect",reason:"byok-connect-routed",disposition:"fallback"}:{"runtime":"managed-local","reason":"eligible"}`));
});

test('fingerprint without any eligible target fails closed', () => {
  const source = `const log=${JSON.stringify(FINGERPRINT)};const native={runtime:"connect",reason:"byok-connect-routed"};`;
  // 有指纹但连 eligible 字面量都没有 → mayContainTurnRoute 为 false, 不算 required
  assert.equal(mayContainTurnRoute(source), false);
  assert.deepEqual(assertTurnRouteShape([{ file: 'main.js', source }]), { required: false });
  const result = guardTurnRoute(source, 'test.js');
  assert.equal(result.changed, 0);
});
