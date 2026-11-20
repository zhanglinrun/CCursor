import { CustomSelect } from './custom-select'
import { Modal } from './modal'

const SEARCH_PROVIDERS = [
  { type: 'tavily', name: 'Tavily', needsKey: true, supportsBaseUrl: true, hint: '为大语言模型提供搜索结果。每月有 1,000 次免费调用，支持自定义接口地址。' },
  { type: 'duckduckgo', name: 'DuckDuckGo', needsKey: false, supportsBaseUrl: false, hint: '免费的备用搜索。遇到反自动化限制时，可能返回 HTTP 202。' },
] as const

const FETCH_PROVIDERS = [
  {
    type: 'tavily',
    name: 'Tavily Extract',
    hint: '通过 Tavily 服务抓取网页，适合内置工具无法访问的页面。复用「搜索」页的 API 密钥和接口地址。',
    reusesSearchConfig: true,
  },
  {
    type: 'builtin',
    name: '内置抓取（supermarkdown）',
    hint: '在本地将网页 HTML 转为 Markdown，无需配置。遇到 Cloudflare 验证时可能无法抓取。',
    reusesSearchConfig: false,
  },
] as const

export function WebToolsButton() {
  return (
    <button
      class="secondary"
      x-on:click="$store.app.webToolsOpen = true"
      title="配置联网搜索与网页抓取服务"
    >
      联网工具
    </button>
  )
}

export function WebToolsDialog() {
  return (
    <Modal showExpr="$store.app.webToolsOpen" title="联网工具">
      <div class="wt-tabs">
        <button
          class="wt-tab"
          x-bind:class="{ active: $store.app.webToolsTab === 'search' }"
          x-on:click="$store.app.webToolsTab = 'search'"
        >
          搜索
        </button>
        <button
          class="wt-tab"
          x-bind:class="{ active: $store.app.webToolsTab === 'fetch' }"
          x-on:click="$store.app.webToolsTab = 'fetch'"
        >
          网页抓取
        </button>
      </div>

      {/* ── 搜索 ── */}
      <div x-show="$store.app.webToolsTab === 'search'">
        <div class="search-providers">
          {SEARCH_PROVIDERS.map(sp => (
            <div class="search-provider-card" key={sp.type}>
              <div class="search-provider-row">
                <div class="search-provider-info">
                  <span class="search-provider-name">{sp.name}</span>
                  <span class="search-provider-hint">{sp.hint}</span>
                </div>
                <label class="qs-switch">
                  <input
                    type="checkbox"
                    aria-label={`启用 ${sp.name}`}
                    x-bind:checked={`$store.app.isSearchProviderEnabled('${sp.type}')`}
                    x-on:change={`$store.app.toggleSearchProvider('${sp.type}', $event.target.checked)`}
                  />
                  <span class="qs-switch-track"></span>
                  <span class="qs-switch-knob"></span>
                </label>
              </div>
              <div class="search-provider-key" x-show={`$store.app.isSearchProviderEnabled('${sp.type}')`}>
                {sp.needsKey && (
                  <input
                    type="password"
                    placeholder="API 密钥"
                    aria-label="Tavily API 密钥"
                    x-bind:value={`$store.app.getSearchProviderKey('${sp.type}')`}
                    x-on:input={`$store.app.setSearchProviderKey('${sp.type}', $event.target.value)`}
                    autocomplete="off"
                  />
                )}
                {sp.supportsBaseUrl && (
                  <>
                    <input
                      type="text"
                      placeholder="接口地址（选填），例如 https://api.tavily.com"
                      aria-label="Tavily 接口地址"
                      x-bind:value={`$store.app.getSearchProviderBaseUrl('${sp.type}')`}
                      x-on:input={`$store.app.setSearchProviderBaseUrl('${sp.type}', $event.target.value)`}
                      autocomplete="off"
                      style="margin-top:4px"
                    />
                    <div class="search-provider-actions">
                      <button
                        type="button"
                        class="search-test-btn"
                        x-on:click={`$store.app.testSearchProvider('${sp.type}')`}
                        x-bind:disabled="$store.app.searchTesting"
                      >
                        <span x-show="!$store.app.searchTesting">测试连接</span>
                        <span x-show="$store.app.searchTesting">测试中…</span>
                      </button>
                      <span
                        class="search-test-result"
                        x-bind:class="'level-' + ($store.app.searchTestResult?.level || 'none')"
                        x-text="$store.app.searchTestResult?.text || ''"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
          <div class="search-options">
            <label class="check" title="同时查询所有已启用的搜索服务，并合并结果">
              <input
                type="checkbox"
                x-bind:checked="$store.app.webTools?.search?.parallel === true"
                x-on:change="$store.app.setSearchOption('parallel', $event.target.checked)"
              />
              {' 并行搜索'}
            </label>
            <div class="search-max-results">
              <label>结果上限</label>
              <CustomSelect
                valueExpr="String($store.app.webTools?.search?.maxResults || 5)"
                changeExpr="$store.app.setSearchOption('maxResults', Number($value))"
                title="搜索结果上限"
                options={[
                  { value: '5', label: '5' },
                  { value: '10', label: '10' },
                  { value: '15', label: '15' },
                  { value: '20', label: '20' },
                  { value: '25', label: '25' },
                ]}
              />
            </div>
          </div>
          <div class="search-options" style="border-top:none;padding-top:0;margin-top:8px">
            <label
              class="check"
              title="所有已配置的搜索服务均失败时，尝试使用 DuckDuckGo 搜索。"
            >
              <input
                type="checkbox"
                x-bind:checked="$store.app.webTools?.search?.fallbackToDuckDuckGo !== false"
                x-on:change="$store.app.setSearchOption('fallbackToDuckDuckGo', $event.target.checked)"
              />
              {' 搜索失败时使用 DuckDuckGo'}
            </label>
          </div>
        </div>
      </div>

      {/* ── 抓取 ── */}
      <div x-show="$store.app.webToolsTab === 'fetch'">
        <div class="fetch-providers">
          {FETCH_PROVIDERS.map(fp => (
            <div class="fetch-provider-card" key={fp.type}>
              <label class="fetch-provider-row">
                <input
                  type="radio"
                  name="fetch-provider"
                  value={fp.type}
                  x-bind:checked={`$store.app.webTools?.fetch?.provider === '${fp.type}'`}
                  x-on:change={`$store.app.setFetchProvider('${fp.type}')`}
                />
                <span class="search-provider-name">{fp.name}</span>
              </label>
              <div class="fetch-provider-hint">{fp.hint}</div>
              {fp.reusesSearchConfig && (
                <div
                  class="fetch-provider-reuse"
                  x-show="$store.app.webTools?.fetch?.provider === 'tavily'"
                >
                  <div
                    class="fetch-provider-reuse-status"
                    x-bind:class="'level-' + $store.app.fetchCredentialStatus.level"
                  >
                    <span x-text="$store.app.fetchCredentialStatus.text" />
                  </div>
                  <button
                    type="button"
                    class="fetch-provider-goto-search"
                    x-on:click="$store.app.webToolsTab = 'search'"
                  >
                    前往「搜索」页配置
                  </button>
                  <div class="search-provider-actions">
                    <button
                      type="button"
                      class="search-test-btn"
                      x-on:click="$store.app.testFetchProvider()"
                      x-bind:disabled="$store.app.fetchTesting"
                    >
                      <span x-show="!$store.app.fetchTesting">测试连接</span>
                      <span x-show="$store.app.fetchTesting">测试中…</span>
                    </button>
                    <span
                      class="search-test-result"
                      x-bind:class="'level-' + ($store.app.fetchTestResult?.level || 'none')"
                      x-text="$store.app.fetchTestResult?.text || ''"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div class="search-dialog-actions">
        <button type="button" x-on:click="$store.app.saveWebTools()">保存</button>
        <button type="button" class="ghost" x-on:click="$store.app.webToolsOpen = false">取消</button>
      </div>
    </Modal>
  )
}
