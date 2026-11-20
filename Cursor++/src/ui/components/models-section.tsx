import { ModelCard } from './model-card'

export function ModelsSection() {
  return (
    <section
      class="models-section"
      x-bind:aria-labelledby="'models-title-' + p.id"
      x-data="{ pasteOpen: false, pastedIds: '', customId: '', chosenQuery: '', removing: false, removeIds: [], get modelIds() { return ($store.app.getDraft(p.id).models || []).map(model => model.id) } }"
      x-effect="if (removing) { const active = new Set(modelIds); const current = removeIds.filter(id => active.has(id)); if (current.length !== removeIds.length) removeIds = current; if (!active.size) removing = false }"
    >
      <div
        class="model-pane available-pane"
        x-data="{ query: '', selected: [], configured: new Set(), get visibleIds() { return $store.app.filteredRemoteModels(p.id, this.query).map(m => m.id).filter(id => !this.configured.has(id)) } }"
        x-effect="configured = $store.app.configuredModelIds(p.id); const available = new Set($store.app.remoteModels[p.id]?.models?.map(model => model.id)); const current = selected.filter(id => available.has(id) && !configured.has(id)); if (current.length !== selected.length) selected = current"
      >
        <div class="models-header">
          <h3 class="models-title" x-bind:id="'models-title-' + p.id">可用模型</h3>
          <div class="models-header-actions">
            <button type="button" class="ghost" x-show="$store.app.remoteModels[p.id]?.models?.length" x-on:click="$store.app.dismissRemoteModels(p.id); query = ''">关闭列表</button>
            <button type="button" class="secondary" x-bind:disabled="!!$store.app.remoteModels[p.id]?.loading" x-on:click="$store.app.fetchRemoteModels(p.id, listProtocol)" x-text="$store.app.remoteModels[p.id]?.loading ? '获取中…' : '获取列表'">获取列表</button>
          </div>
        </div>
        <div class="model-search">
          <input type="search" aria-label="搜索可用模型" placeholder="搜索模型名称或 ID" x-model="query" x-bind:disabled="!$store.app.remoteModels[p.id]?.models?.length" />
        </div>
        <p class="model-empty" x-show="!$store.app.remoteModels[p.id]">获取服务商提供的模型列表。</p>
        <p class="model-list-recovery" role="status" x-show="$store.app.remoteModels[p.id]?.error || $store.app.remoteModels[p.id]?.models?.length === 0" x-bind:class="{ err: $store.app.remoteModels[p.id]?.error }" x-text="$store.app.remoteModels[p.id]?.error || '服务商没有返回可用模型'" x-cloak></p>

        <template x-if="$store.app.remoteModels[p.id]?.models?.length">
          <div class="remote-models-panel">
            <div class="model-selection-bar">
              <span role="status" x-text="$store.app.filteredRemoteModels(p.id, query).length + ' 个结果'"></span>
              <button
                type="button"
                class="tiny secondary"
                x-bind:disabled="!visibleIds.length"
                x-on:click="selected = $store.app.toggleVisibleModels(visibleIds, selected)"
                x-text="visibleIds.length && visibleIds.every(id => selected.includes(id)) ? '取消当前选择' : '选择当前结果'"
              >
              </button>
            </div>
            <div class="remote-models-list" role="group" aria-label="勾选要导入的模型">
              <template x-for="(rm, index) in $store.app.filteredRemoteModels(p.id, query)" x-bind:key="rm.id + ':' + index">
                <label class="remote-model-item" x-bind:title="rm.id" x-bind:class="{ 'already-added': configured.has(rm.id), 'is-selected': selected.includes(rm.id) }">
                  <input type="checkbox" x-bind:value="rm.id" x-model="selected" x-bind:disabled="configured.has(rm.id)" />
                  <span class="remote-model-label">
                    <span class="remote-model-name" x-text="$store.app.remoteModelPrimary(rm)"></span>
                    <span class="remote-model-id" x-show="$store.app.remoteModelSecondary(rm)" x-text="$store.app.remoteModelSecondary(rm)"></span>
                  </span>
                  <span class="remote-model-count" title="上下文 / 最大输出（Token）" x-show="!configured.has(rm.id) && (rm.contextTokenLimit || rm.maxOutputTokens)" x-text="[$store.app.fmtCtx(rm.contextTokenLimit), $store.app.fmtCtx(rm.maxOutputTokens)].join(' / ')"></span>
                  <span class="remote-model-added" x-show="configured.has(rm.id)">已添加</span>
                </label>
              </template>
              <p class="model-empty remote-models-no-match" role="status" x-show="!$store.app.filteredRemoteModels(p.id, query).length">没有匹配的模型</p>
            </div>
            <div class="model-import-actions">
              <span role="status" x-text="'已选 ' + selected.length + ' 个'"></span>
              <button type="button" x-bind:disabled="!selected.length" x-on:click="$store.app.importModels(p.id, selected); selected = []; chosenQuery = ''">导入所选模型</button>
            </div>
          </div>
        </template>
      </div>

      <div class="model-pane configured-pane">
        <div class="models-header">
          <h3 class="models-title">
            已配置模型
            <span class="service-count" x-text="modelIds.length"></span>
          </h3>
          <div class="models-header-actions">
            <button type="button" class="ghost" x-show="modelIds.length" x-bind:aria-pressed="removing" x-on:click="removing = !removing; removeIds = []; chosenQuery = ''" x-text="removing ? '退出多选' : '批量删除'"></button>
          </div>
        </div>
        <div class="model-search" x-show="!removing">
          <input type="search" placeholder="搜索已配置模型" aria-label="搜索已配置模型" x-model="chosenQuery" x-bind:disabled="!modelIds.length" />
        </div>

        <div class="model-import-review" x-data="{ get review() { return $store.app.importReview(p.id) } }" x-show="review.models.length" x-cloak>
          <p role="status" x-text="'本次新增 ' + review.models.length + ' 个 · 参数齐全 ' + review.ready.length + ' 个 · 待补参数 ' + review.needs.length + ' 个' + (review.pending.length ? ' · 回填中 ' + review.pending.length + ' 个' : '')"></p>
          <div class="model-import-issues" x-show="review.needs.length">
            <template x-for="model in review.needs" x-bind:key="model.id">
              <button
                type="button"
                class="secondary"
                x-on:click="chosenQuery = ''; $store.app.openImportedModel(p.id, model.id); $nextTick(() => { const field = document.getElementById('model-editor-' + p.id + '-' + model.id); field?.scrollIntoView({ block: 'nearest' }); field?.querySelector('input.invalid')?.focus({ preventScroll: true }) })"
                x-text="'补参数 · ' + (model.displayName || model.apiModel)"
              >
              </button>
            </template>
          </div>
          <div class="model-import-actions">
            <button type="button" class="secondary" x-bind:disabled="!review.ready.length || !!$store.app.batchTesting[p.id]" title="测试本次新增且参数齐全的模型，会发送真实请求" x-on:click="$store.app.testAllModels(p.id, true)">测试本次导入</button>
            <button type="button" x-bind:disabled="!!review.pending.length || !!review.needs.length || !!$store.app.savingProviders[p.id]" x-on:click="$store.app.saveProvider(p.id)" x-text="$store.app.savingProviders[p.id] ? '保存中…' : '保存模型配置'">保存模型配置</button>
          </div>
        </div>

        <p class="model-empty" x-show="!modelIds.length && !pasteOpen">从可用列表导入，或手动添加模型。</p>
        <p class="model-empty" x-show="modelIds.length && !$store.app.filteredConfiguredModels(p.id, chosenQuery).length">没有匹配的模型</p>
        <div class="model-remove-actions" x-show="removing" x-cloak>
          <span role="status" x-text="'已选 ' + removeIds.length + ' 个'"></span>
          <button type="button" class="tiny secondary" x-on:click="removeIds = removeIds.length === modelIds.length ? [] : [...modelIds]" x-text="removeIds.length === modelIds.length ? '取消全选' : '全选模型'"></button>
          <button type="button" class="danger" x-bind:disabled="!removeIds.length" x-on:click="$store.app.requestRemoveModels(p.id, removeIds)">删除所选</button>
        </div>
        <div class="configured-models-list">
          <template x-for="m in $store.app.filteredConfiguredModels(p.id, chosenQuery)" x-bind:key="m.id">
            <ModelCard />
          </template>
        </div>
        <div class="custom-model-entry">
          <form class="custom-model-form" {...{ 'x-on:submit.prevent': 'if (customId.trim()) { $store.app.importModels(p.id, [customId]); customId = \'\'; chosenQuery = \'\' }' }}>
            <input type="text" aria-label="自定义模型 ID" placeholder="输入模型 ID" x-model="customId" />
            <button type="submit" class="secondary" x-bind:disabled="!customId.trim()">添加模型</button>
          </form>
          <div class="models-header-actions">
            <button type="button" class="ghost" x-bind:aria-expanded="pasteOpen" x-bind:aria-controls="'paste-models-panel-' + p.id" x-on:click="pasteOpen = !pasteOpen; if (pasteOpen) $nextTick(() => $refs.pastedIds.focus())">粘贴多行 ID</button>
            <button type="button" class="ghost" x-on:click="chosenQuery = ''; const model = $store.app.addModel(p.id); $nextTick(() => document.getElementById('model-editor-' + p.id + '-' + model.id)?.scrollIntoView({ block: 'nearest' }))">手动配置</button>
          </div>
          <div class="model-import-paste" x-bind:id="'paste-models-panel-' + p.id" x-bind:hidden="!pasteOpen" x-cloak>
            <label x-bind:for="'paste-models-' + p.id">模型 ID，每行一个</label>
            <textarea x-ref="pastedIds" x-bind:id="'paste-models-' + p.id" rows={3} placeholder={'gpt-6.2-sol\nclaude-sonnet'} x-model="pastedIds"></textarea>
            <button type="button" class="secondary" x-bind:disabled="!pastedIds.trim()" x-on:click="$store.app.importModels(p.id, pastedIds.split('\n')); pastedIds = ''; chosenQuery = ''; pasteOpen = false">批量导入 ID</button>
          </div>
        </div>
      </div>
    </section>
  )
}
