import { ProviderAccordion } from './provider-accordion'

/** 模型目录摘要与服务商列表。 */
export function Providers() {
  return (
    <div>
      <section class="catalog-card" aria-label="模型目录">
        <div class="catalog-toolbar">
          <div class="catalog-info">
            <div class="catalog-heading">
              <span class="catalog-title">模型目录</span>
              <span class="catalog-source">models.dev</span>
              <span class="catalog-badge" x-text="$store.app.catalogSourceLabel"></span>
            </div>
            <div class="catalog-counts" role="status" aria-live="polite" x-text="$store.app.catalogSummary"></div>
          </div>
          <button
            class="secondary catalog-refresh"
            type="button"
            x-bind:disabled="$store.app.catalogBusy"
            x-bind:aria-busy="$store.app.catalogBusy"
            x-on:click="$store.app.refreshCatalog()"
            title="从 models.dev 更新模型参数，不修改已保存的服务商配置"
          >
            <span class="catalog-refresh-icon" x-bind:class="{ 'is-spinning': $store.app.catalogBusy }" aria-hidden="true">↻</span>
            <span x-text="$store.app.catalogBusy ? '更新中…' : '更新目录'">更新目录</span>
          </button>
        </div>
        <div class="catalog-meta">
          <span>上次更新</span>
          <span x-text="$store.app.catalogUpdatedAt"></span>
        </div>
        <p class="catalog-note">选择可用模型后自动填参，保存后生效；更新目录不会覆盖已有配置。</p>
        <div class="catalog-error" role="alert" x-show="$store.app.catalogStatus?.lastError" x-cloak>
          <strong x-text="$store.app.catalogStatus?.source === 'empty' ? '模型目录暂不可用，请尝试更新。' : '目录更新失败，已保留原有数据。'"></strong>
          <span x-text="$store.app.catalogStatus?.lastError"></span>
        </div>
      </section>
      <template x-if="$store.app.providers.length === 0">
        <div class="gate">
          <div class="gate-title">添加第一个服务商</div>
          <div class="gate-text">填入中转站或官方服务的地址和密钥，再获取可用模型。选择模型即可自动填入参数。</div>
          <div class="gate-actions">
            <button x-on:click="$store.app.addProvider()">+ 添加服务商</button>
            <button class="secondary" x-on:click="$store.app.post('editProvidersJson')">编辑配置文件</button>
          </div>
        </div>
      </template>
      <template x-for="(p, pIdx) in $store.app.providers" x-bind:key="p.id">
        <ProviderAccordion />
      </template>
    </div>
  )
}
