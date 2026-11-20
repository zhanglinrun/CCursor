/**
 * Agent Host / Always-Local HTTP/1.1 传输守卫 (Cursor 3.26+ / 3.31+).
 *
 * 根因：
 *   Cursor 3.31 移除 legacy agent-host 门闩后，本地 Agent 回合始终走 `cursor-agent-host`。
 *   `AiConnectTransportHandler.createTransportsForLatestContext` 根据
 *   `this.lastServerHttp2DisabledValue` 与 `this.host.isHttp2Disabled()` 决定是否用 HTTP/2：
 *     - `lastServerHttp2DisabledValue` 仅在每 10 分钟一次的定时器里刷新，
 *       启动 (`init`) 和凭据变更 (`creds`) 重建 transport 时仍为 `undefined`。
 *     - 若用户未手动设置 `cursor.general.disableHttp2 = true`，Agent Host 会对
 *       `http://127.0.0.1:39831`（仅支持 HTTP/1.1 的本地 Fastify 服务）建立 HTTP/2 连接，
 *       立刻触发 `ConnectError: [internal] Protocol error (ERR_HTTP2_ERROR, errno: -505)`。
 *
 * 改写：
 *   1. `isHttp2Disabled()`：当同进程路由表接管 `/agent.v1.AgentService/RunSSE`（BYOK 开启）时
 *      直接返回 `true`，走 HTTP/1.1 (`RunSSE` + `BidiAppend`)；BYOK 关闭时落回原逻辑，
 *      不修改用户设置，不破坏官方 HTTP/2。
 *   2. `setupEventListeners()`：订阅同进程路由表暴露的 `__byokOnRouteChange`，
 *      在运行时热切换 BYOK ON/OFF 时主动触发 `this.setup("protocol_settings")` 重建 transport，
 *      无需重启 Cursor。
 */

export const HTTP1_GUARD_MARKER = '/*BYOK-HTTP1-GUARD*/';
export const HTTP1_REBUILD_MARKER = '/*BYOK-HTTP1-REBUILD*/';

const ROUTED_PATH = '/agent.v1.AgentService/RunSSE';
const IS_HTTP2_ANCHOR = 'isHttp2Disabled(){return this.httpProtocolFallback.isDisabled("http2")';
const IS_HTTP2_HEAD = 'isHttp2Disabled(){';
const REBUILD_ANCHOR = 'this.disposables.push(this.host.onDidChangeHttpProtocolSettings(';

export function hasHttp1GuardAnchor(source) {
  return typeof source === 'string' && source.includes(IS_HTTP2_ANCHOR);
}

export function isHttp1GuardPatched(source) {
  if (typeof source !== 'string') return false;
  if (!hasHttp1GuardAnchor(source)) return true;
  if (!source.includes(HTTP1_GUARD_MARKER)) return false;
  if (source.includes(REBUILD_ANCHOR) && !source.includes(HTTP1_REBUILD_MARKER)) return false;
  return true;
}

/**
 * 注入 HTTP/1.1 守卫与热切换重建钩子（幂等）。
 * 目标中不存在锚点时原样返回（不阻断旧版 Cursor）。
 *
 * @returns {{ source: string, changed: boolean }}
 */
export function guardAgentHttp1(source) {
  if (typeof source !== 'string') return { source, changed: false };
  let out = source;
  let changed = false;

  if (out.includes(IS_HTTP2_ANCHOR) && !out.includes(HTTP1_GUARD_MARKER)) {
    const idx = out.indexOf(IS_HTTP2_ANCHOR);
    const insertAt = idx + IS_HTTP2_HEAD.length;
    const guard = `${HTTP1_GUARD_MARKER}if(globalThis.__byokRpcRouted&&globalThis.__byokRpcRouted(${JSON.stringify(ROUTED_PATH)}))return!0;`;
    out = out.slice(0, insertAt) + guard + out.slice(insertAt);
    changed = true;
  }

  if (out.includes(REBUILD_ANCHOR) && !out.includes(HTTP1_REBUILD_MARKER)) {
    const idx = out.indexOf(REBUILD_ANCHOR);
    const hook = `${HTTP1_REBUILD_MARKER}globalThis.__byokOnRouteChange&&this.disposables.push({dispose:globalThis.__byokOnRouteChange((()=>{this.cursorCreds&&this.setup("protocol_settings").catch((()=>{}))}))}),`;
    out = out.slice(0, idx) + hook + out.slice(idx);
    changed = true;
  }

  return { source: out, changed };
}
