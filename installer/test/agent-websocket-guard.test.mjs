import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AGENT_WS_GATE_MARKER,
  AGENT_WS_ORIGINS_MARKER,
  disableAgentWebSocket,
  isAgentWebSocketDisabled,
} from '../src/agent-websocket-guard.js';

const BASE_STACK = `
const path = "/agent/v1/run";
function createAgentRunWebSocketSelection() { return null; }
`;

test('disables single nal_websocket_client literal and accepted-origin set idempotently', () => {
  const source = `${BASE_STACK}
const origins = new Set(["https://api.playground.cursor.sh", "https://api2.cursor.sh"]);
const cfg = { featureGate: "nal_websocket_client", poolConfig: "nal_websocket_client_pool" };
`;
  assert.equal(isAgentWebSocketDisabled(source), false);

  const first = disableAgentWebSocket(source, 'test.js');
  assert.equal(first.required, true);
  assert.equal(first.changed, true);
  assert.ok(first.source.includes(AGENT_WS_GATE_MARKER));
  assert.ok(first.source.includes(AGENT_WS_ORIGINS_MARKER));
  assert.ok(!first.source.includes('"nal_websocket_client"'));
  assert.ok(!first.source.includes('https://api2.cursor.sh'));
  assert.equal(isAgentWebSocketDisabled(first.source), true);

  const second = disableAgentWebSocket(first.source, 'test.js');
  assert.equal(second.changed, false);
  assert.equal(second.source, first.source);
});

test('disables multiple nal_websocket_client literals (incl. template literal) and multiple accepted-origin sets without touching schema keys', () => {
  const source = `${BASE_STACK}
const originsA = new Set(["https://api.playground.cursor.sh", "https://api2.cursor.sh"]);
const originsB = new Set(["https://api.playground.cursor.sh", "https://api2.cursor.sh", "https://api3.cursor.sh"]);
const cfgA = { featureGate: "nal_websocket_client" };
function shouldUseWs(host) { return host.checkFeatureGate(\`nal_websocket_client\`); }
const schemaQuoted = { "nal_websocket_client": { client: true, default: true } };
const schemaComputed = { ["nal_websocket_client"]: { client: true, default: true } };
const tagged = tag\`nal_websocket_client\`;
`;
  const result = disableAgentWebSocket(source, 'cursor-always-local main.js');
  assert.equal(result.required, true);
  assert.equal(result.changed, true);
  assert.equal(isAgentWebSocketDisabled(result.source), true);
  assert.equal((result.source.match(new RegExp(AGENT_WS_GATE_MARKER, 'g')) || []).length, 2);
  assert.equal((result.source.match(new RegExp(AGENT_WS_ORIGINS_MARKER, 'g')) || []).length, 2);
  assert.ok(result.source.includes('"nal_websocket_client": { client: true, default: true }'));
  assert.ok(result.source.includes('["nal_websocket_client"]: { client: true, default: true }'));
  assert.ok(result.source.includes('tag`nal_websocket_client`'));
});

test('fails closed on overlapping WebSocket guard edits instead of producing corrupted JS', () => {
  const overlapping = `${BASE_STACK}
const bad = ["https://api.playground.cursor.sh", "https://api2.cursor.sh", "nal_websocket_client"];
`;
  assert.throws(() => disableAgentWebSocket(overlapping, 'test.js'), /overlapping WebSocket guard edits/);
});

test('fails closed when WebSocket stack exists but gate literal or origin set is missing', () => {
  const noGate = `${BASE_STACK}
const origins = new Set(["https://api.playground.cursor.sh", "https://api2.cursor.sh"]);
`;
  assert.throws(() => disableAgentWebSocket(noGate, 'test.js'), /expected at least one nal_websocket_client gate literal, found 0/);

  const noOrigins = `${BASE_STACK}
const cfg = { featureGate: "nal_websocket_client" };
`;
  assert.throws(() => disableAgentWebSocket(noOrigins, 'test.js'), /expected at least one Agent WebSocket accepted-origin set, found 0/);
});
