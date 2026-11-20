/**
 * 顶部横幅。路由补丁缺失时升格为置顶告警条：补丁没注入，自有模型根本不会生效，
 * 所以这是唯一需要用户马上动手的状态，按钮也放到横幅里而不是折叠的高级设置。
 */
export function Banner() {
  return (
    <div
      x-show="$store.app.state"
      class="byok-banner"
      x-bind:class="{
        'blocked': $store.app.state?.routingPatchPresent === false,
        'is-active': $store.app.state?.routingPatchPresent !== false && !!$store.app.state?.byokMode,
      }"
    >
      <div class="byok-status-wrap">
        <span
          class="byok-status-dot"
          aria-hidden="true"
          x-bind:class="{
            'is-ok': $store.app.state?.routingPatchPresent !== false && !!$store.app.state?.byokMode,
            'is-warn': $store.app.state?.routingPatchPresent === false,
          }"
        >
        </span>
        <div class="byok-label">
          <span
            class="byok-title"
            x-text="$store.app.state?.routingPatchPresent === false ? '需要先注入路由补丁' : $store.app.state?.byokMode ? '自有模型已启用' : '使用 Cursor 官方模型'"
          >
          </span>
          <span
            class="byok-hint"
            x-text="$store.app.state?.routingPatchPresent === false ? '注入前自有模型不会生效。点击「重新注入」，Cursor 会自动重启。' : $store.app.state?.byokMode ? '使用已配置的服务商和 API 密钥' : '请求直接转发至 Cursor 官方服务'"
          >
          </span>
        </div>
      </div>
      <div class="banner-actions">
        <button
          type="button"
          class="banner-primary"
          x-show="$store.app.state?.routingPatchPresent === false"
          x-on:click="$store.app.post('injectRouting')"
        >
          重新注入
        </button>
        <button
          type="button"
          x-show="$store.app.state?.routingPatchPresent !== false"
          x-bind:class="$store.app.state?.byokMode ? 'secondary banner-toggle' : 'banner-toggle'"
          x-text="$store.app.state?.byokMode ? '切换官方模式' : '启用自有模型'"
          x-on:click="$store.app.post('toggleByok')"
        >
        </button>
      </div>
    </div>
  )
}
