export function Banner() {
  return (
    <header
      x-show="$store.app.state"
      x-cloak
      class="byok-banner"
      x-bind:class="{
        'blocked': $store.app.state?.routingPatchPresent === false,
        'is-active': $store.app.state?.routingPatchPresent !== false && !!$store.app.state?.byokMode,
      }"
    >
      <div class="byok-status-wrap">
        <svg
          class="byok-glyph byok-alert"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
          x-show="$store.app.state?.routingPatchPresent === false"
        >
          <path d="M10 2.5 16 5v4.5c0 3.4-2.3 6.5-6 8-3.7-1.5-6-4.6-6-8V5l6-2.5Z" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round" />
          <path d="M10 6.75v3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          <circle cx="10" cy="12.75" r=".85" fill="currentColor" />
        </svg>
        <svg class="byok-glyph byok-ready" viewBox="0 0 20 20" aria-hidden="true" x-show="$store.app.state?.routingPatchPresent !== false">
          <circle cx="10" cy="10" r="8" fill="currentColor" opacity=".16" />
          <circle cx="10" cy="10" r="3.5" fill="currentColor" />
        </svg>
        <div class="byok-label">
          <div class="byok-heading" role="status">
            <strong class="byok-title" x-text="$store.app.state?.routingPatchPresent === false ? '需要先注入路由补丁' : $store.app.state?.byokMode ? '自有模型' : 'Cursor 官方模式'"></strong>
            <span class="byok-pill" x-show="$store.app.state?.routingPatchPresent !== false" x-text="$store.app.state?.byokMode ? 'BYOK ON' : 'BYOK OFF'"></span>
          </div>
          <span class="byok-hint" x-show="$store.app.state?.routingPatchPresent === false" x-text="$store.app.routingPatchHint"></span>
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
        <button type="button" class="ghost" x-show="$store.app.state?.routingPatchPresent === false" x-on:click="$store.app.post('recheckRouting')">重新检测</button>
        <button
          type="button"
          x-show="$store.app.state?.routingPatchPresent !== false"
          x-bind:class="$store.app.state?.byokMode ? 'secondary banner-toggle' : 'banner-toggle'"
          x-text="$store.app.state?.byokMode ? '切换官方模式' : '启用自有模型'"
          x-on:click="$store.app.post('setByokMode', { mode: $store.app.state?.byokMode ? 0 : 1 })"
        >
        </button>
      </div>
    </header>
  )
}
