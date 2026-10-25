import { ProviderAccordion } from './provider-accordion'

/** Provider 列表容器 */
export function Providers() {
  return (
    <div>
      <div class="section" role="status" aria-live="polite">
        <div class="hint" x-text="$store.app.catalogSummary"></div>
        <div class="hint" x-text="'Last successful update: ' + $store.app.catalogUpdatedAt"></div>
        <div class="hint">Catalog defaults apply only when selecting a model; saved provider settings are not updated. No API key required.</div>
        <button
          class="secondary"
          x-bind:disabled="$store.app.catalogBusy"
          x-bind:aria-busy="$store.app.catalogBusy"
          x-on:click="$store.app.refreshCatalog()"
          x-text="$store.app.catalogBusy ? 'Refreshing catalog…' : 'Refresh catalog'"
        >
          Refresh catalog
        </button>
        <div class="hint" role="alert" x-show="$store.app.catalogStatus?.lastError" x-text="$store.app.catalogStatus?.lastError" x-cloak></div>
      </div>
      {/*
        门禁式空状态 —— 不给一个"空列表 + 按钮", 而是说清这一步在做什么、
        以及下一步该点哪里。协议是这里最容易卡住的一步，所以空状态里就点出来。
      */}
      <template x-if="$store.app.providers.length === 0">
        <div class="gate">
          <div class="gate-title">No providers yet</div>
          <div class="gate-text">
            Add a relay or an official endpoint for Cursor to use. You do not need to
            figure out the protocol yourself — fill in the base URL, key and model name,
            then click "Auto-detect". The plugin probes with real requests and shows the
            full final request URL below.
          </div>
          <div class="gate-actions">
            <button x-on:click="$store.app.addProvider()">+ Add Provider</button>
            <button class="secondary" x-on:click="$store.app.post('editProvidersJson')">Edit providers.json</button>
          </div>
        </div>
      </template>
      <template x-for="(p, pIdx) in $store.app.providers" x-bind:key="p.id">
        <ProviderAccordion />
      </template>
    </div>
  )
}
