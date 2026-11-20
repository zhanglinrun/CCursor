import assert from 'node:assert/strict';
import test from 'node:test';
import * as acorn from 'acorn';
import {
  buildHookPayload,
  isTransportWaitPatched,
  patchConnectTransportWait,
  TRANSPORT_WAIT_MARKER,
} from '../src/patch-inject.js';

// Cursor connectRequestService 的最小复刻（预算变量名是混淆名，每版不同）
// Cursor connectRequestService 的最小复刻（预算变量名是混淆名，每版不同）
function transportWaitSource(budgetName = 'Fdr', authName = 'Qop', { withAuth = true } = {}) {
  const lines = [
    `var ${authName}=3e4,Jop=100,${budgetName}=12e4,E$i={didSignalAuthReady:"code/cursor/didSignalAuthReady"};`,
    'class RequestService{',
    `  async transport(){try{return await wait(this._provider,AbortSignal.timeout(${budgetName}))}`,
    '  catch{throw this.structuredLogService.warn("transport","Connect transport did not register within the wait budget",',
    `  {subkey:"connect_transport_wait_timeout",waitedMs:String(${budgetName})}),new Error("No Connect transport provider registered.")}}`,
    `  async extensionHostTransport(){try{return await wait(this._extensionHostProvider,AbortSignal.timeout(${budgetName}))}`,
    '  catch{throw new Error("No extension-host Connect transport registered.")}}',
  ];
  if (withAuth) {
    lines.push(
      `  async awaitAuth(){try{return await wait(this._authReady,AbortSignal.timeout(${authName}))}`,
      '  catch{return this.structuredLogService.warn("auth","Timeout waiting for auth ready signal",',
      '  {subkey:"auth_ready_timeout",waitedMs:String(0)}),{isReady:!1,hasToken:!1}}',
      '  }',
    );
  }
  lines.push('}');
  return lines.join('\n');
}

test('both wait budgets drop to 1.5s only while BYOK is on', () => {
  const source = transportWaitSource();
  const patched = patchConnectTransportWait(source, () => {});
  assert.notEqual(patched, source);
  assert.ok(isTransportWaitPatched(patched));
  assert.ok(patched.includes(TRANSPORT_WAIT_MARKER));
  // BYOK 关掉时仍是 Cursor 原始预算
  assert.ok(patched.includes('?1500:12e4'));
  assert.ok(patched.includes('catch(e){return 12e4}'));
  // 预算变量名不变，两处使用点无需改动
  assert.ok(patched.includes('AbortSignal.timeout(Fdr)'));
  assert.doesNotThrow(() => acorn.parse(patched, { ecmaVersion: 'latest', sourceType: 'script' }));
});

test('transport wait patch follows a renamed budget variable and is idempotent', () => {
  const renamed = patchConnectTransportWait(transportWaitSource('Zz9'), () => {});
  assert.ok(renamed.includes('Zz9=/*BYOK-TRANSPORT-WAIT*/'));
  const twice = patchConnectTransportWait(renamed, () => {});
  assert.equal(twice, renamed);
});

test('transport wait patch leaves code untouched without a nearby anchor', () => {
  const source = 'var unrelated=1;function noop(){return 12e4}';
  assert.equal(patchConnectTransportWait(source, () => {}), source);
  // 初始化语句距使用点超过窗口上限时放弃改写，避免改到无关的 12e4
  const far = `var Fdr=12e4;${'.'.repeat(7000)}function f(){w("connect_transport_wait_timeout")}`;
  assert.equal(patchConnectTransportWait(far, () => {}), far);
});

test('renderer payload keeps its IIFE balanced and seeds the BYOK mode flag', () => {
  const payload = buildHookPayload(true, 'desktop');
  assert.doesNotThrow(() => acorn.parse(`/* CURSOR-BYOK-HOOK-START */${payload}`, { ecmaVersion: 'latest', sourceType: 'script' }));
  assert.ok(payload.includes('localStorage.setItem("__byokModeLastKnown"'));
  assert.ok(payload.trimEnd().endsWith('})()'));
});
