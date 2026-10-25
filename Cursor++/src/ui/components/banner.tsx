/** BYOK 模式横幅 */
export function Banner() {
  return (
    <div x-show="$store.app.state" class="byok-banner">
      <div class="byok-label">
        <span class="byok-title" x-text="$store.app.state?.byokMode ? '自有模型 · 已启用' : '官方模式'"></span>
        <span
          class="byok-hint"
          x-text="$store.app.state?.byokMode ? '使用已配置的服务商和 API 密钥' : '请求直接转发至 Cursor 官方服务'"
        >
        </span>
      </div>
      <div class="banner-actions">
        <button
          x-bind:class="$store.app.state?.byokMode ? 'on' : 'off'"
          x-text="$store.app.state?.byokMode ? '切换官方模式' : '启用自有模型'"
          x-on:click="$store.app.post('toggleByok')"
        >
        </button>
      </div>
    </div>
  )
}
