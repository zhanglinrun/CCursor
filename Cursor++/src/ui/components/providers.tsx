import { ProviderEditor } from './provider-accordion'
import { WebToolsButton } from './search-section'

export function Providers() {
  return (
    <div>
      <div x-show="!$store.app.editingProviderId">
        <header class="config-header">
          <h2>
            AI 服务
            <span class="service-count" x-text="$store.app.providers.length"></span>
          </h2>
          <div class="config-actions">
            <WebToolsButton />
            <button type="button" class="settings-primary" x-on:click="$store.app.addProvider()">+ 添加服务</button>
          </div>
        </header>
        <div class="service-list" role="list" aria-label="AI 服务">
          <template x-for="(p, index) in $store.app.providers" x-bind:key="p.id">
            <div class="service-row" role="listitem" x-bind:class="{ 'service-disabled': $store.app.baseProvider(p.id)?.enabled === false }">
              <button class="service-open ghost" type="button" x-bind:aria-label="'编辑 ' + (p.name || '未命名服务商')" x-on:click="$store.app.openProvider(p.id)">
                <span class="service-icon" aria-hidden="true" x-text="(p.name || '+').slice(0, 1).toUpperCase()"></span>
                <span class="service-identity">
                  <span class="service-name">
                    <strong x-text="p.name || '未命名服务商'"></strong>
                    <span class="catalog-badge" x-show="$store.app.baseProvider(p.id)?.enabled === false" x-cloak>已停用</span>
                    <span class="catalog-badge" x-show="$store.app.isDirty(p.id)" x-cloak>未保存</span>
                  </span>
                  <span class="service-meta" x-text="$store.app.providerHost(p.baseUrl) + ' · ' + (p.models?.length || 0) + ' 个模型'"></span>
                </span>
              </button>
              <button
                type="button"
                class="service-switch"
                role="switch"
                x-show="$store.app.baseProvider(p.id)"
                x-bind:aria-label="'启用 ' + p.name"
                x-bind:aria-checked="$store.app.baseProvider(p.id)?.enabled !== false"
                x-bind:disabled="!!$store.app.savingProviders[p.id]"
                x-on:click="$store.app.setProviderEnabled(p.id, $store.app.baseProvider(p.id)?.enabled === false)"
              >
              </button>
              <div class="service-sort" x-show="$store.app.baseProvider(p.id) && $store.app.state.providers.length > 1" x-cloak>
                <button type="button" class="sort-btn sort-up" aria-label="上移服务" title="上移服务" x-bind:disabled="Object.keys($store.app.savingProviders).length > 0" x-on:click="$store.app.moveProvider(p.id, -1)" x-show="index > 0"></button>
                <button type="button" class="sort-btn sort-down" aria-label="下移服务" title="下移服务" x-bind:disabled="Object.keys($store.app.savingProviders).length > 0" x-on:click="$store.app.moveProvider(p.id, 1)" x-show="index < $store.app.state.providers.length - 1"></button>
              </div>
            </div>
          </template>
          <p class="empty" x-show="!$store.app.providers.length">添加服务地址和密钥后，可从服务商获取模型。</p>
        </div>
        <section class="catalog-status" aria-label="模型目录">
          <div class="catalog-toolbar">
            <span class="catalog-info" role="status" aria-live="polite" x-text="[$store.app.catalogSourceLabel, $store.app.catalogSummary, $store.app.catalogUpdatedAt].join(' · ')"></span>
            <button class="ghost catalog-refresh" type="button" x-bind:disabled="$store.app.catalogBusy" x-on:click="$store.app.refreshCatalog()">
              <span class="catalog-refresh-icon" x-bind:class="{ 'is-spinning': $store.app.catalogBusy }" aria-hidden="true">↻</span>
              <span x-text="$store.app.catalogBusy ? '更新中…' : '更新模型目录'"></span>
            </button>
          </div>
          <div class="catalog-error" role="alert" x-show="$store.app.catalogStatus?.lastError" x-text="$store.app.catalogStatus?.lastError" x-cloak></div>
        </section>
      </div>
      <template x-for="p in $store.app.providers.filter(provider => provider.id === $store.app.editingProviderId)" x-bind:key="p.id">
        <ProviderEditor />
      </template>
    </div>
  )
}
