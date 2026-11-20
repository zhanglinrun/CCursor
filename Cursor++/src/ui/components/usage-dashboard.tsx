function UsageScopeBlock({ scope }: { scope: 'today' | 'allTime' }) {
  const totals = `$store.app.usageScopeTotals('${scope}')`
  const amount = (field: string) => `$store.app.formatCount(${totals}?.${field})`
  return (
    <section class="usage-scope" aria-labelledby={`usage-${scope}`}>
      <header class="usage-scope-head">
        <h3 id={`usage-${scope}`}>{scope === 'today' ? '今日用量' : '累计用量'}</h3>
        <span class="usage-scope-range" x-text={`$store.app.usageScopeSubtitle('${scope}')`}></span>
      </header>
      <div class="usage-cache">
        <div class="usage-cache-main">
          <span class="usage-label">缓存命中率</span>
          <strong class="usage-value usage-rate" x-text={`$store.app.formatPercent(${totals}?.cacheHitRate)`}></strong>
        </div>
        <div class="usage-cache-meter" aria-hidden="true">
          <span x-bind:style={`{ width: ${totals}?.cacheHitRate == null ? '0%' : $store.app.formatPercent(${totals}?.cacheHitRate) }`}></span>
        </div>
        <div class="usage-cache-details">
          <span>
            缓存读取
            {' '}
            <strong x-text={amount('cacheReadTokens')}></strong>
          </span>
          <span>
            未命中
            {' '}
            <strong x-text={amount('nonCachedInputTokens')}></strong>
          </span>
        </div>
      </div>
      <dl class="usage-metrics">
        <div>
          <dt>输入 Token</dt>
          <dd class="usage-value" x-text={amount('promptTokens')} x-bind:title={`$store.app.usagePromptTitle('${scope}')`}></dd>
        </div>
        <div>
          <dt>输出 Token</dt>
          <dd class="usage-value" x-text={amount('outputTokens')}></dd>
        </div>
        <div>
          <dt>模型请求</dt>
          <dd class="usage-value" x-text={amount('calls')}></dd>
        </div>
      </dl>
    </section>
  )
}

export function UsageDashboard() {
  return (
    <section class="usage" aria-labelledby="usage-title">
      <header class="usage-header">
        <h2 id="usage-title">用量与缓存</h2>
        <button
          type="button"
          class="secondary dashboard-action"
          x-bind:disabled="$store.app.usageLoading"
          x-on:click="$store.app.loadUsageStats()"
          x-text="$store.app.usageLoading ? '刷新中…' : '刷新用量'"
        >
        </button>
      </header>

      <div class="usage-body">
        <p class="notice notice-bad" role="alert" x-show="$store.app.usageError" x-cloak>
          <span class="notice-text" x-text="'用量读取失败：' + $store.app.usageError"></span>
        </p>
        <p
          class="usage-empty"
          role="status"
          x-show="!$store.app.usageError && !$store.app.usageHasData()"
          x-cloak
          x-text="$store.app.usageLoading ? '正在读取用量…' : '暂无用量记录。完成一次自有模型请求后，这里会显示统计。'"
        >
        </p>

        <div class="usage-content" x-show="$store.app.usageHasData()" x-cloak>
          <div class="usage-scopes">
            <UsageScopeBlock scope="today" />
            <UsageScopeBlock scope="allTime" />
          </div>

          <div class="usage-window">
            <span>统计范围</span>
            <div class="usage-window-options" role="group" aria-label="趋势与模型用量的统计范围">
              <template x-for="days in [7, 14]" x-bind:key="days">
                <button
                  type="button"
                  x-bind:aria-pressed="($store.app.usageStats?.windowDays ?? 14) === days"
                  x-bind:disabled="$store.app.usageLoading"
                  x-on:click="$store.app.loadUsageStats(days)"
                  x-text="'近 ' + days + ' 天'"
                >
                </button>
              </template>
            </div>
          </div>

          <section class="usage-detail" aria-labelledby="usage-trend-title">
            <header class="usage-detail-head">
              <h3 id="usage-trend-title">输入趋势</h3>
            </header>
            <template x-if="$store.app.usageHasTrend()">
              <div>
                <div class="usage-legend">
                  <span>
                    <i class="usage-swatch usage-swatch-cached" aria-hidden="true"></i>
                    缓存读取
                  </span>
                  <span>
                    <i class="usage-swatch usage-swatch-write" aria-hidden="true"></i>
                    缓存写入
                  </span>
                  <span>
                    <i class="usage-swatch usage-swatch-new" aria-hidden="true"></i>
                    其他输入
                  </span>
                </div>
                <div class="usage-chart" role="group" aria-label="每日输入用量" x-on:mouseleave="$store.app.clearUsageHover()">
                  <template x-for="(day, index) in $store.app.usageDays()" x-bind:key="day.date">
                    <button
                      type="button"
                      class="usage-slot"
                      x-bind:aria-label="$store.app.usageDayLabel(day)"
                      x-on:mouseenter="$store.app.setUsageHover(day, index, $store.app.usageDays().length)"
                      x-on:focus="$store.app.setUsageHover(day, index, $store.app.usageDays().length)"
                      x-on:click="$store.app.setUsageHover(day, index, $store.app.usageDays().length)"
                      x-on:blur="$store.app.clearUsageHover()"
                      {...{ 'x-on:keydown.escape': '$store.app.clearUsageHover()' }}
                    >
                      <span class="usage-col" aria-hidden="true" x-bind:style="{ height: $store.app.usageColumnHeight(day) + '%' }">
                        <span class="usage-col-cached" x-bind:style="{ height: $store.app.usageCacheShare(day, day.cacheReadTokens) + '%' }"></span>
                        <span class="usage-col-write" x-bind:style="{ height: $store.app.usageCacheShare(day, day.cacheWriteTokens) + '%' }"></span>
                      </span>
                    </button>
                  </template>
                  <div
                    class="usage-tip"
                    aria-hidden="true"
                    x-bind:class="{ 'is-open': $store.app.usageHover !== null }"
                    x-bind:style="$store.app.usageTipStyle()"
                  >
                    <div class="usage-tip-date" x-text="$store.app.usageTipDate()"></div>
                    <template x-for="row in $store.app.usageHoverRows()" x-bind:key="row.label">
                      <div class="usage-tip-row">
                        <span x-text="row.label"></span>
                        <strong x-text="row.value"></strong>
                      </div>
                    </template>
                  </div>
                </div>
                <div class="usage-axis" x-text="$store.app.usageRangeLabel()"></div>
              </div>
            </template>
            <p class="usage-empty usage-empty-inline" x-show="!$store.app.usageHasTrend()">这段时间没有输入用量</p>
          </section>

          <section class="usage-detail" aria-labelledby="usage-models-title">
            <header class="usage-detail-head">
              <h3 id="usage-models-title">模型用量</h3>
              <span class="usage-period">按输入 Token 排序</span>
            </header>
            <template x-if="$store.app.usageModelRows().length">
              <table class="usage-table" aria-labelledby="usage-models-title">
                <thead>
                  <tr>
                    <th scope="col">模型</th>
                    <th class="usage-row-input" scope="col" aria-sort="descending">输入 Token</th>
                    <th scope="col">缓存命中率</th>
                    <th scope="col">请求次数</th>
                  </tr>
                </thead>
                <tbody>
                  <template x-for="row in $store.app.usageModelRows()" x-bind:key="JSON.stringify([row.provider, row.model])">
                    <tr>
                      <td>
                        <span class="usage-row-model" x-text="row.model"></span>
                        <span class="usage-row-provider" x-text="row.provider"></span>
                        <span class="usage-row-input-inline" x-text="'输入 Token ' + $store.app.formatCount(row.promptTokens)"></span>
                      </td>
                      <td class="usage-row-input" x-text="$store.app.formatCount(row.promptTokens)" x-bind:title="row.promptTokens.toLocaleString('zh-CN')"></td>
                      <td class="usage-row-rate" x-bind:class="'tone-' + $store.app.usageTone(row.cacheHitRate)" x-text="$store.app.formatPercent(row.cacheHitRate)"></td>
                      <td class="usage-row-calls" x-text="$store.app.formatCount(row.calls)"></td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </template>
            <p class="usage-empty usage-empty-inline" x-show="!$store.app.usageModelRows().length">这段时间没有模型请求</p>
          </section>
        </div>
      </div>
    </section>
  )
}
